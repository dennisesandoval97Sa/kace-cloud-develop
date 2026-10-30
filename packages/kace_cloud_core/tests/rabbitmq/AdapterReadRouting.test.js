import { KnexAdapterSettingsRepository } from '../../src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js';
import { Criteria } from '../../src/shared/criteria/Criteria.js';
import { DbRequestContext } from '../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../knexfile.js';
import { watchPools } from '../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const buildCriteria = () => new Criteria(undefined, undefined, null, 0, null, 'broker_adapters');

const countValue = (row) => Number(Object.values(row)[0]);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

// Tier B: broker_adapters admin CRUD → list/count reads route to the replica,
// while findById/findByName (write-path guards) stay on the writer.
describe('KnexAdapterSettingsRepository — reader wiring (Oleada 16)', () => {
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

    const seedAdapters = async (knex, n) => {
        const rows = Array.from({ length: n }, () => ({
            id: nextUuid(),
            name: `adapter-${idSeq}`,
            host: 'localhost',
            port: 5672,
            queue: `queue-${idSeq}`,
            exchange: null,
            vhost: null,
            username: null,
            password: null,
            created_at: new Date().toISOString(),
            deleted_at: null,
            deleted_by: null,
        }));
        if (rows.length) await knex('broker_adapters').insert(rows);
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexAdapterSettingsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexAdapterSettingsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAdapterSettingsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(buildCriteria())).length;
        await seedAdapters(repo.writer, 3);

        pools.reset();
        expect(await repo.search(buildCriteria())).toHaveLength(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 3);
    });

    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAdapterSettingsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countValue(await repo.count(buildCriteria()));
        await seedAdapters(repo.writer, 3);

        pools.reset();
        expect(countValue(await repo.count(buildCriteria()))).toBe(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countValue(afterWrite)).toBe(baseline + 3);
    });

    it('create() marks the request as written so subsequent reads fall to the writer', async () => {
        repo = new KnexAdapterSettingsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countValue(await repo.count(buildCriteria()));
        await seedAdapters(repo.writer, 3);

        const afterWrite = await DbRequestContext.run(async () => {
            await repo.create({
                id: nextUuid(),
                name: 'adapter-created',
                host: 'localhost',
                port: 5672,
                queue: 'queue-created',
                vhost: null,
                exchange: null,
                username: null,
                password: null,
                password_encryption_migrated: { value: true },
            });
            expect(DbRequestContext.hasWritten()).toBe(true);
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countValue(afterWrite)).toBe(baseline + 4);
    });

    it('update() marks the request as written so subsequent reads fall to the writer', async () => {
        repo = new KnexAdapterSettingsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countValue(await repo.count(buildCriteria()));
        await seedAdapters(repo.writer, 3);
        const [{ id }] = await repo.writer('broker_adapters').select('id').limit(1).orderBy('id', 'desc');

        const afterWrite = await DbRequestContext.run(async () => {
            await repo.update(id, { host: 'updated-host' });
            expect(DbRequestContext.hasWritten()).toBe(true);
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countValue(afterWrite)).toBe(baseline + 3);
    });
});
