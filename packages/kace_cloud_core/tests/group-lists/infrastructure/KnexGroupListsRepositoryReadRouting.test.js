import { KnexGroupListsRepository } from '../../../src/group-lists/infrastructure/persistence/KnexGroupListsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

const stubCriteria = { convertToKnex: (qb) => qb };
// count() devuelve un numero, no la fila cruda; el Number es por si un dia vuelve a
// llegar el string que pg entrega para count().
const countVal = (r) => Number(r);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

const row = (id, descripcion) => ({
    id,
    descripcion,
    lista_grupos: JSON.stringify([]),
    is_active: true,
    created_at: CREATED_AT,
    created_by: CREATED_BY,
    deleted_at: null,
    deleted_by: null,
});

const seed = async (knex, n) => {
    const rows = Array.from({ length: n }, () => row(nextUuid(), 'seeded'));
    if (rows.length) await knex('lista_grupos').insert(rows);
};

describe('KnexGroupListsRepository — reader wiring (Oleada 7 Tier B)', () => {
    let repo;
    let pools;
    afterEach(async () => {
        // Desenganchar listeners no lanza consultas, por eso va aqui y no en un afterAll: los
        // afterAll de este archivo corren DESPUES del DROP DATABASE de perFileDatabase.js.
        if (pools) {
            pools.stop();
            pools = undefined;
        }

        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
    });

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexGroupListsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexGroupListsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('find() resolves via the replica pool, then via the writer pool after a write', async () => {
        repo = new KnexGroupListsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const id = nextUuid();
        await repo.writer('lista_grupos').insert(row(id, 'INITIAL'));

        pools.reset();
        const viaReplica = await repo.find({ value: id });
        expect(pools.lastPool()).toBe('reader');
        expect(viaReplica.descripcion.value).toBe('INITIAL');

        const viaWriter = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find({ value: id });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(viaWriter.descripcion.value).toBe('INITIAL');
    });

    // Baseline delta, not an absolute count: the cloned per-file database is a clone of a
    // migrated+seeded template, so lista_grupos may already carry rows before this test inserts.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexGroupListsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(stubCriteria)).length;
        await seed(repo.writer, 2);

        pools.reset();
        expect(await repo.search(stubCriteria)).toHaveLength(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 2);
    });

    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexGroupListsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countVal(await repo.count(stubCriteria));
        await seed(repo.writer, 2);

        pools.reset();
        expect(countVal(await repo.count(stubCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countVal(afterWrite)).toBe(baseline + 2);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexGroupListsRepository(makeWriterConfig(), makeReaderConfig());
        const id = nextUuid();
        const stubToSave = {
            id: { value: id },
            descripcion: { value: 'NEW' },
            lista_grupos: { value: [] },
            is_active: { value: true },
            created_at: { value: CREATED_AT },
            created_by: { value: CREATED_BY },
        };

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave);
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('update() marks the request as written', async () => {
        repo = new KnexGroupListsRepository(makeWriterConfig(), makeReaderConfig());
        const id = nextUuid();
        await repo.writer('lista_grupos').insert(row(id, 'ORIGINAL'));

        const wrote = await DbRequestContext.run(async () => {
            await repo.update({ changedAttributes: { descripcion: 'CHANGED', lista_grupos: [] }, id: { value: id } });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
