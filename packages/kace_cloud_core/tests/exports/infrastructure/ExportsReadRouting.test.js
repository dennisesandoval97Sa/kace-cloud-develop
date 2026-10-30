import { KnexExportsRepository } from '../../../src/exports/infraestructure/persistence/KnexExportsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `3333333${idSeq++}-3333-4333-8333-333333333333`);

// Tier B: exports is 100% reads → getData/getUserGroupLinks route to the replica.
//
// Writer and reader configs are two routes to the SAME physical database (see
// tests/knexfile.js), so a row written via one pool is instantly visible via the other — a
// writer/reader marker split can no longer prove which pool served a read. These tests seed
// through the writer only and assert on `reader`/`writer` pool identity (the actual mechanism
// under test) plus baseline-delta counts, while still exercising each method end-to-end.
describe('KnexExportsRepository — reader wiring (Oleada 15)', () => {
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

    const seedClients = async (knex, ids) => {
        for (const id of ids) {
            await knex('clients').insert({ id });
        }
    };

    // rel_usuarios_grupos.usuario_id/grupo_id are FK-constrained (usuarios, grupos); real parent
    // rows are seeded so the inserts satisfy those constraints.
    const seedUserGroups = async (knex, userId, groupIds) => {
        await knex('usuarios').insert({ id: userId });
        for (const groupId of groupIds) {
            await knex('grupos').insert({ id: groupId });
            await knex('rel_usuarios_grupos').insert({ usuario_id: userId, grupo_id: groupId });
        }
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexExportsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexExportsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('getData() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexExportsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.getData('clients')).length;
        await seedClients(repo.writer, nextIds(2));

        pools.reset();
        expect(await repo.getData('clients')).toHaveLength(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.getData('clients');
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 2);
    });

    it('getUserGroupLinks() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexExportsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const [userId] = nextIds(1);
        const groupIds = nextIds(3);
        await seedUserGroups(repo.writer, userId, groupIds);

        pools.reset();
        expect(await repo.getUserGroupLinks([userId])).toHaveLength(3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.getUserGroupLinks([userId]);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(3);
    });
});
