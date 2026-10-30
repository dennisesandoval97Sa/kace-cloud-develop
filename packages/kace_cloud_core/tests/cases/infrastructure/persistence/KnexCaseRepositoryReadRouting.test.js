import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { EntityCache, ValueObjectUuid } from '../../../../src/shared/index.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// Case ids (and every FK id referenced below) must be valid UUIDs: CaseDataGrid -> AggregateRoot
// -> ValueObjectUuid validates them. The per-file database is cloned once for the whole file
// (see tests/knexfile.js), not per `it()`, so ids must stay unique across every test in this file.
let idSeq = 0;
const nextId = () => `ffffffff-ffff-4fff-8fff-${String(idSeq++).padStart(12, '0')}`;

// Seeds one case with the full FK graph #addRelationships/#addSelectFields joins through:
// clients, grupos, usuarios (responsable), transiciones -> estados, clasificaciones. Every
// parent row is real (not fabricated tables), satisfying cases' FK constraints.
// `descripcion_caso_id`, `created_at` y `created_by` van aparte del grafo de joins: no los pide
// ninguna de esas consultas, sino el agregado Case, que los exige no nulos al hidratarse en find().
const seedCase = async (knex) => {
    const clienteId = nextId();
    const grupoId = nextId();
    const responsableId = nextId();
    const estadoId = nextId();
    const transicionId = nextId();
    const clasificacionId = nextId();
    const descripcionCasoId = nextId();
    const caseId = nextId();

    await knex('clients').insert({ id: clienteId });
    await knex('grupos').insert({ id: grupoId });
    await knex('usuarios').insert({ id: responsableId });
    await knex('estados').insert({ id: estadoId, nombre: 'Open', color: '#fff' });
    await knex('transiciones').insert({ id: transicionId, siguiente_estado_id: estadoId });
    await knex('clasificaciones').insert({ id: clasificacionId });
    await knex('descripciones_casos').insert({ id: descripcionCasoId, descripcion: 'seed' });
    await knex('cases').insert({
        id: caseId,
        cliente_id: clienteId,
        grupo_id: grupoId,
        responsable_id: responsableId,
        transicion_id: transicionId,
        clasificacion_id: clasificacionId,
        descripcion_caso_id: descripcionCasoId,
        created_at: new Date(),
        created_by: responsableId,
        deleted_at: null,
    });

    return caseId;
};

// Mirrors the real Criteria.convertToKnex contract: it mutates the builder in place AND
// returns it (count() reassigns `query` from the return value).
const noopCriteria = () => ({ convertToKnex: (qb) => qb });

const countOf = (result) => parseInt(result.count, 10);

describe('KnexCaseRepository — read routing (list/count)', () => {
    let repo;
    let pools;

    afterEach(async () => {
        if (pools) {
            pools.stop();
            pools = undefined;
        }

        EntityCache.invalidateNamespace('cases:count');
        EntityCache.invalidateNamespace('cases:searchCount');
        EntityCache.invalidateNamespace('cases:countByStatus');
        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
    });

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexCaseRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('search()/searchPlain()/count() resolve through the reader pool, then the writer pool after a write', async () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const caseId = await seedCase(repo.writer);

        pools.reset();

        const rows = await repo.search(noopCriteria());
        expect(pools.lastPool()).toBe('reader');
        expect(rows.some((r) => r.toJson().id === caseId)).toBe(true);

        const plainRows = await repo.searchPlain(noopCriteria());
        expect(plainRows.some((r) => r.id === caseId)).toBe(true);

        const countResult = await repo.count(noopCriteria());
        expect(countOf(countResult)).toBeGreaterThanOrEqual(1);

        // count() caches its result per criteria (see buildCountCacheKey); force a fresh read so
        // the post-write call below isn't just replaying the cached pre-write value.
        EntityCache.invalidateNamespace('cases:count');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();

            return {
                rows: await repo.search(noopCriteria()),
                plainRows: await repo.searchPlain(noopCriteria()),
                count: await repo.count(noopCriteria()),
            };
        });
        expect(pools.lastPool()).toBe('writer');

        expect(afterWrite.rows.some((r) => r.toJson().id === caseId)).toBe(true);
        expect(afterWrite.plainRows.some((r) => r.id === caseId)).toBe(true);
        expect(countOf(afterWrite.count)).toBeGreaterThanOrEqual(1);
    });

    // findReadOnly() es la lectura del caso de case-reclassification-precheck (priority:false).
    // Va aparte de find() a proposito: find() se lee ANTES de escribir en CaseUpdater (autoriza,
    // decide si el caso esta resuelto y compara los snapshots CAS), asi que ese debe seguir
    // saliendo por el writer.
    it('findReadOnly() resolves through the reader pool, then the writer pool after a write', async () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const caseId = await seedCase(repo.writer);

        pools.reset();

        const kase = await repo.findReadOnly(new ValueObjectUuid('id', caseId));
        expect(pools.lastPool()).toBe('reader');
        expect(kase.toJson().id).toBe(caseId);

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();

            return repo.findReadOnly(new ValueObjectUuid('id', caseId));
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.toJson().id).toBe(caseId);
    });

    // La lectura que alimenta una escritura no puede venir de una replica con retraso: sobre una
    // fila atrasada, CaseUpdater autorizaria, decidiria "no resuelto" y compararia los snapshots
    // CAS contra datos viejos. El servicio `cases` es priority:false, asi que sin esta garantia el
    // enrutamiento se la llevaria por delante.
    it('find() stays on the writer pool even with a reader configured', async () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const caseId = await seedCase(repo.writer);

        pools.reset();

        const kase = await repo.find(new ValueObjectUuid('id', caseId));
        expect(pools.lastPool()).toBe('writer');
        expect(kase.toJson().id).toBe(caseId);
    });
});
