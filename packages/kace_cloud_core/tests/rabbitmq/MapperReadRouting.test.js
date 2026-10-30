import { KnexMapperRepository } from '../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { Criteria } from '../../src/shared/criteria/Criteria.js';
import { DbRequestContext } from '../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../knexfile.js';
import { watchPools } from '../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const buildCriteria = () => new Criteria(undefined, undefined, null, 0, null, 'broker_message_mappers');

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

// Tier B: broker_message_mappers admin CRUD → list/count reads route to the replica,
// while findById (write-path existence guard) stays on the writer.
describe('KnexMapperRepository — reader wiring (Oleada 16)', () => {
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

    // broker_message_mapper_rules.mapper_id is FK-constrained (broker_message_mappers); each
    // seeded mapper gets one child rule row.
    const seedMappers = async (knex, n) => {
        for (let i = 0; i < n; i++) {
            const mapperId = nextUuid();
            await knex('broker_message_mappers').insert({
                id: mapperId,
                name: `mapper-${idSeq}`,
                rest_flow_id: null,
                queue: `queue-${idSeq}`,
                created_at: new Date().toISOString(),
                created_by: null,
                deleted_at: null,
                deleted_by: null,
            });
            await knex('broker_message_mapper_rules').insert({
                id: nextUuid(),
                mapper_id: mapperId,
                target_entity: 'case',
                target_field: 'subject',
                source_field: 'payload.subject',
                parse_to: null,
                created_at: new Date().toISOString(),
                deleted_at: null,
                deleted_by: null,
            });
        }
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexMapperRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexMapperRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexMapperRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(buildCriteria())).length;
        await seedMappers(repo.writer, 3);

        pools.reset();
        const fromReplica = await repo.search(buildCriteria());
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica).toHaveLength(baseline + 3);
        expect(fromReplica.every((m) => m.rules.length >= 1)).toBe(true);

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 3);
    });

    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexMapperRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = await repo.count(buildCriteria());
        await seedMappers(repo.writer, 3);

        pools.reset();
        expect(await repo.count(buildCriteria())).toBe(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toBe(baseline + 3);
    });

    it('create() marks the request as written so subsequent reads fall to the writer', async () => {
        repo = new KnexMapperRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = await repo.count(buildCriteria());
        await seedMappers(repo.writer, 3);

        const afterWrite = await DbRequestContext.run(async () => {
            await repo.create({
                id: nextUuid(),
                name: 'mapper-created',
                rest_flow_id: null,
                rules: [
                    {
                        id: nextUuid(),
                        target_entity: 'case',
                        target_field: 'subject',
                        source_field: 'payload.subject',
                        parse_to: null,
                    },
                ],
            });
            expect(DbRequestContext.hasWritten()).toBe(true);
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toBe(baseline + 4);
    });

    it('update() marks the request as written so subsequent reads fall to the writer', async () => {
        repo = new KnexMapperRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = await repo.count(buildCriteria());
        await seedMappers(repo.writer, 3);
        const [{ id }] = await repo.writer('broker_message_mappers').select('id').limit(1).orderBy('id', 'desc');

        const afterWrite = await DbRequestContext.run(async () => {
            await repo.update(id, { name: 'updated-name' });
            expect(DbRequestContext.hasWritten()).toBe(true);
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toBe(baseline + 3);
    });
});
