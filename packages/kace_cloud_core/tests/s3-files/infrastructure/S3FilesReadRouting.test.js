import { KnexS3FileRepository } from '../../../src/s3-files/infrastructure/persistence/KnexS3FileRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const num = (r) => Number(r && typeof r === 'object' ? Object.values(r)[0] : r);

const CREATED_BY = '59999999-5555-4555-8555-555555555555';

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUUIDs = (n) =>
    Array.from({ length: n }, () => `5${String(idSeq++).padStart(7, '0')}-5555-4555-8555-555555555555`);

// Tier B: s3_files CRUD → find/search/count route to the replica; save/update/delete pin the writer.
describe('KnexS3FileRepository — reader wiring (Oleada 15)', () => {
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

    const seed = async (knex, ids) => {
        for (const id of ids) {
            await knex('s3_files').insert({
                id,
                description: 'seed',
                file_name: `${id}.txt`,
                s3_file_name: `s3-${id}.txt`,
                url: 'https://example.com/file',
                size: 10,
                expired_at: new Date().toISOString(),
                origin: 'default',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: null,
                created_by: CREATED_BY,
                updated_by: null,
                deleted_at: null,
                deleted_by: null,
            });
        }
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexS3FileRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexS3FileRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('find() executes against the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexS3FileRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const [id] = nextUUIDs(1);
        await seed(repo.writer, [id]);

        pools.reset();
        const fromReplica = await repo.find({ value: id });
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica.file_name.value).toBe(`${id}.txt`);

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find({ value: id });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.file_name.value).toBe(`${id}.txt`);
    });

    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexS3FileRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search({ convertToKnex: (qb) => qb })).length;
        const ids = nextUUIDs(3);
        await seed(repo.writer, ids);

        const criteria = { convertToKnex: (qb) => qb };
        pools.reset();
        expect(await repo.search(criteria)).toHaveLength(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(criteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 3);
    });

    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexS3FileRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = num(await repo.count(stubCriteria));
        const ids = nextUUIDs(2);
        await seed(repo.writer, ids);

        pools.reset();
        expect(num(await repo.count(stubCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(num(afterWrite)).toBe(baseline + 2);
    });

    it('save() marks the request as written, forcing subsequent reads onto the writer', async () => {
        repo = new KnexS3FileRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = num(await repo.count(stubCriteria));
        const [fileId] = nextUUIDs(1);

        const file = {
            id: { value: fileId },
            description: { value: 'new' },
            file_name: { value: 'new.txt' },
            s3_file_name: { value: 's3-new.txt' },
            url: { value: 'https://example.com/new' },
            size: { value: 20 },
            expired_at: { value: new Date().toISOString() },
            origin: { value: 'default' },
            is_active: { value: true },
            created_at: { value: new Date().toISOString() },
            updated_at: { value: null },
            created_by: { value: CREATED_BY },
            updated_by: { value: null },
        };

        const countAfterSave = await DbRequestContext.run(async () => {
            await repo.save(file);
            expect(DbRequestContext.hasWritten()).toBe(true);
            pools.reset();
            return repo.count(stubCriteria);
        });
        // Tras la escritura el reader tiene que caer al writer: la consulta la ejecuta ese pool.
        expect(pools.lastPool()).toBe('writer');
        expect(num(countAfterSave)).toBe(baseline + 1);
    });
});
