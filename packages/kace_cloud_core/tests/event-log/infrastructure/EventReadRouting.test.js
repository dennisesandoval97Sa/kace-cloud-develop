import { KnexEventRepository } from '../../../src/event-log/infrastructure/KnexEventRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

let idSeq = 0;
const UUID = () => `44444444-4444-4444-8444-4444444444${String(idSeq++).padStart(2, '0')}`;

// Criteria stub: the real Criteria mutates the query builder; here we no-op so the
// tests isolate the connection (reader vs writer) rather than the filtering logic.
const noopCriteria = { convertToKnex: (qb) => qb };

const seedEventLogs = async (knex, rows) => {
    for (const row of rows) {
        await knex('event_logs').insert(row);
    }
};

const makeRow = (caseId = null) => ({
    id: UUID(),
    event_name: 'case.event',
    occurred_at: new Date().toISOString(),
    initiated_by_user: UUID(),
    aggregate_id: UUID(),
    body: JSON.stringify({ foo: 'bar' }),
    old_data: JSON.stringify({}),
    case_id: caseId,
    client_id: null,
});

// Tier B: event-logs is 100% reads → find/search/count/getEventsByCaseId route to the
// replica; save() stays on the writer and marks the request as written (defensive pattern).
//
// Writer and reader configs are two routes to the SAME physical database (see
// tests/knexfile.js), so a row written via one pool is instantly visible via the other — a
// writer/reader marker split can no longer prove which pool served a read. These tests seed
// through the writer only and assert on `reader`/`writer` pool identity (the actual mechanism
// under test) plus baseline-delta counts, while still exercising each method end-to-end.
describe('KnexEventRepository — reader wiring (Oleada 16)', () => {
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
        repo = new KnexEventRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe collapse)', () => {
        repo = new KnexEventRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('find() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexEventRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const id = UUID();
        await seedEventLogs(repo.writer, [{ ...makeRow(), id, event_name: 'seeded.event' }]);

        pools.reset();
        const fromReplica = await repo.find({ value: id });
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica.event_name.value).toBe('seeded.event');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find({ value: id });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.event_name.value).toBe('seeded.event');
    });

    it('search() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexEventRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(noopCriteria)).length;
        await seedEventLogs(repo.writer, [makeRow(), makeRow(), makeRow()]);

        pools.reset();
        expect(await repo.search(noopCriteria)).toHaveLength(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(noopCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 3);
    });

    it('count() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexEventRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = Number(Object.values(await repo.count(noopCriteria))[0]);
        await seedEventLogs(repo.writer, [makeRow(), makeRow(), makeRow()]);

        pools.reset();
        const readerCount = Number(Object.values(await repo.count(noopCriteria))[0]);
        expect(pools.lastPool()).toBe('reader');
        expect(readerCount).toBe(baseline + 3);

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(noopCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(Number(Object.values(afterWrite)[0])).toBe(baseline + 3);
    });

    it('getEventsByCaseId() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexEventRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const caseId = UUID();
        await seedEventLogs(repo.writer, [makeRow(caseId), makeRow(caseId), makeRow(caseId)]);

        pools.reset();
        expect(await repo.getEventsByCaseId({ value: caseId }, noopCriteria)).toHaveLength(3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.getEventsByCaseId({ value: caseId }, noopCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(3);
    });

    it('save() marks the request as a write (defensive pattern) and lands on the writer', async () => {
        repo = new KnexEventRepository(makeWriterConfig(), makeReaderConfig());

        const stubEvent = {
            id: { value: UUID() },
            event_name: { value: 'case.saved' },
            occurred_at: { value: new Date().toISOString() },
            initiated_by_user: { value: UUID() },
            aggregate_id: { value: UUID() },
            body: { value: { foo: 'bar' } },
            old_data: { value: {} },
            case_id: { value: null },
            client_id: { value: null },
        };

        const written = await DbRequestContext.run(async () => {
            await repo.save(stubEvent);
            return DbRequestContext.hasWritten();
        });

        expect(written).toBe(true);

        // The insert landed on the writer pool, not the reader.
        const writerRow = await repo.writer('event_logs').where({ id: stubEvent.id.value }).first();
        expect(writerRow).toBeDefined();
    });
});
