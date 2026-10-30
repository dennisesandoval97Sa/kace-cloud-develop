import { KnexClassificationsLevelDistinctionRepository } from '../../../src/states/index.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids/markers must stay unique across every test in this file.
let idSeq = 0;
const nextId = (prefix) => `${prefix}-${idSeq++}`;

// find() joins cases -> transiciones -> estados (on COALESCE(estado_actual_id, siguiente_estado_id))
// and counts cases grouped by estado. Writer and reader configs are two routes to the SAME
// physical database (see tests/knexfile.js), so a marker estado name can no longer distinguish
// which pool served the read the way separate sqlite :memory: instances used to — the per-file
// database is also a clone of a migrated+seeded template with pre-existing cases/estados. A
// unique marker name per seed still lets us pick out just our own row from the grouped result.
const seedCase = async (knex) => {
    const estadoId = nextId('estado');
    const marker = nextId('estado-name');
    const transId = nextId('trans');
    const caseId = nextId('case');
    await knex('estados').insert({ id: estadoId, nombre: marker });
    await knex('transiciones').insert({ id: transId, estado_actual_id: estadoId, siguiente_estado_id: null });
    await knex('cases').insert({ id: caseId, transicion_id: transId });
    return marker;
};

describe('KnexClassificationsLevelDistinctionRepository (states) — read routing', () => {
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

    it('find() executes against the resolved reader pool', async () => {
        repo = new KnexClassificationsLevelDistinctionRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const marker = await seedCase(repo.writer);

        pools.reset();
        const rows = await repo.find();
        expect(pools.lastPool()).toBe('reader');

        const row = rows.find((r) => r.estado === marker);
        expect(row).toBeDefined();
        expect(Number(row.total)).toBe(1);
    });

    it('find() flips to the writer after markWrite() (read-after-write)', async () => {
        repo = new KnexClassificationsLevelDistinctionRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const marker = await seedCase(repo.writer);

        const rows = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find();
        });
        expect(pools.lastPool()).toBe('writer');

        const row = rows.find((r) => r.estado === marker);
        expect(row).toBeDefined();
        expect(Number(row.total)).toBe(1);
    });
});
