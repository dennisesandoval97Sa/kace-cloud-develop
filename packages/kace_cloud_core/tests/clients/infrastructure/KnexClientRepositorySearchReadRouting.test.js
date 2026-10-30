import { v4 as uuidv4 } from 'uuid';
import { KnexClientRepository } from '../../../src/clients/index.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// Client (src/clients/domain/Client.js) wraps id in ValueObjectUuid, which validates real
// UUID format — random ids are also naturally unique across every `it()` in this file (the
// per-file database is shared across the whole file, see tests/knexfile.js).
const nextIds = (n) => Array.from({ length: n }, () => uuidv4());

const noopCriteria = () => ({ convertToKnex: (qb) => qb });

const seed = async (knex, ids) => {
    for (const id of ids) {
        await knex('clients').insert({
            id,
            status: 1,
            padre_id: null,
            deleted_by: null,
            deleted_at: null,
            created_at: new Date().toISOString(),
            created_by: id,
        });
    }
};

// Writer and reader configs are two routes to the SAME physical database (see
// tests/knexfile.js); a row inserted via one pool is instantly visible via the other, so a
// writer/reader marker split can no longer prove which pool served a read. This asserts on
// `reader`/`writer` pool identity (the actual mechanism under test) and on baseline-delta
// search()/count() results — the migrated template pre-seeds `clients` rows, though `search()`
// and `count()` filter differently (search() excludes soft-deleted rows via `whereNull
// ('deleted_by')`; count() does not filter at all), so their baselines are computed separately.
describe('KnexClientRepository search/count — read routing', () => {
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
        repo = new KnexClientRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexClientRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('search() and count() read from the replica, then from the writer after a write', async () => {
        repo = new KnexClientRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const searchBaseline = (await repo.search(noopCriteria())).length;
        const countBaseline = parseInt(Object.values((await repo.count(noopCriteria()))[0])[0], 10);

        const ids = nextIds(2);
        await seed(repo.writer, ids);

        pools.reset();
        expect(await repo.search(noopCriteria())).toHaveLength(searchBaseline + 2);
        expect(pools.lastPool()).toBe('reader');
        const countRows = await repo.count(noopCriteria());
        expect(parseInt(Object.values(countRows[0])[0], 10)).toBe(countBaseline + 2);

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(noopCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(searchBaseline + 2);
    });
});
