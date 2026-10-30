import KnexClassificationsLevelDistinctionRepository from '../../src/ClassificationsLevelDistinction/infrasctructure/KnexClassificationsLevelDistinctionRepository.js';
import { DbRequestContext } from '../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../knexfile.js';
import { watchPools } from '../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

let idSeq = 0;
const nextId = () => `cld${idSeq++}`;

// find() returns DISTINCT non-deleted nivel1 values, and the migrated template already seeds a
// 'Categoria' row, so the assertion below checks the seeded marker is present in the result set
// (not that it's the only value). Writer and reader configs are two routes to the SAME physical
// database (see tests/knexfile.js), so a writer/reader marker split can no longer prove which
// pool served a read; this asserts on `reader`/`writer` pool identity (the actual mechanism
// under test) while still exercising find() end-to-end.
const seed = async (knex, nivel1) => {
    await knex('clasificaciones').insert({ id: nextId(), nivel1, deleted_at: null });
};

describe('KnexClassificationsLevelDistinctionRepository — reader wiring', () => {
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

    it('opens a separate reader pool when a distinct reader config is provided', () => {
        repo = new KnexClassificationsLevelDistinctionRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool when no reader config is provided (fail-safe)', () => {
        repo = new KnexClassificationsLevelDistinctionRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('find reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexClassificationsLevelDistinctionRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const marker = `marker-${nextId()}`;
        await seed(repo.writer, marker);

        pools.reset();
        const fromReplica = await repo.find('nivel1');
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica).toContainEqual({ level: marker });

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find('nivel1');
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toContainEqual({ level: marker });
    });
});
