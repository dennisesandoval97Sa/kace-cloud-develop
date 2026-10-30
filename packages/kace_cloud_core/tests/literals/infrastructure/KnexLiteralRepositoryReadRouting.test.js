import { KnexLiteralRepository } from '../../../src/literals/infrastructure/persistence/KnexLiteralRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

const stubCriteria = { convertToKnex: (qb) => qb };

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

const row = (id, nombre) => ({
    id,
    tipo_literal: nextUuid(),
    nombre,
    is_active: true,
    created_at: CREATED_AT,
    created_by: CREATED_BY,
    deleted_at: null,
    deleted_by: null,
});

const seed = async (knex, n) => {
    const rows = Array.from({ length: n }, () => row(nextUuid(), 'seeded'));
    if (rows.length) await knex('literales').insert(rows);
};

describe('KnexLiteralRepository — reader wiring (Oleada 7 Tier B)', () => {
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
        repo = new KnexLiteralRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexLiteralRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('find() resolves via the replica pool, then via the writer pool after a write (read-after-write)', async () => {
        repo = new KnexLiteralRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const id = nextUuid();
        await repo.writer('literales').insert(row(id, 'INITIAL'));

        pools.reset();
        const viaReplica = await repo.find({ value: id });
        expect(pools.lastPool()).toBe('reader');
        expect(viaReplica.nombre.value).toBe('INITIAL');

        const viaWriter = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find({ value: id });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(viaWriter.nombre.value).toBe('INITIAL');
    });

    // Baseline delta, not an absolute count: the cloned per-file database is a clone of a
    // migrated+seeded template, so literales already carries rows before this test inserts.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexLiteralRepository(makeWriterConfig(), makeReaderConfig());
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

    it('save() marks the request as written (routes subsequent reads to the writer)', async () => {
        repo = new KnexLiteralRepository(makeWriterConfig(), makeReaderConfig());
        const stubLiteralToSave = {
            id: { value: nextUuid() },
            tipo_literal: { value: nextUuid() },
            nombre: { value: 'NEW' },
            is_active: { value: true },
            created_at: { value: null },
            created_by: { value: null },
            deleted_at: { value: null },
            deleted_by: { value: null },
        };

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubLiteralToSave);
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('update() marks the request as written', async () => {
        repo = new KnexLiteralRepository(makeWriterConfig(), makeReaderConfig());
        const id = nextUuid();
        await repo.writer('literales').insert(row(id, 'ORIGINAL'));

        const wrote = await DbRequestContext.run(async () => {
            await repo.update({ changedAttributes: { nombre: 'CHANGED' }, id: { value: id } });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
