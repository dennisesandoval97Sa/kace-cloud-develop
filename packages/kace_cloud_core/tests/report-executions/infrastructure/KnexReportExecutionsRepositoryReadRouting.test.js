import { KnexReportExecutionsRepository } from '../../../src/report-executions/infrastructure/persistence/KnexReportExecutionsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const num = (r) => Number(r && typeof r === 'object' ? Object.values(r)[0] : r);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

// count() (repo override) reads via this.read (no ReportExecution construction). find/findAll/search
// route through the identical facade. save() is a direct insert guarded by markWrite.
// report_executions.issued_by is FK-constrained (usuarios); a real parent row is seeded so
// inserts satisfy that constraint. Uses a baseline delta, not an absolute count: the cloned
// per-file database is a clone of a migrated+seeded template, so report_executions may already
// carry rows before this test inserts.
const seedUser = async (knex) => {
    const id = nextUuid();
    await knex('usuarios').insert({ id });
    return id;
};

const seed = async (knex, n, issuedBy) => {
    const rows = Array.from({ length: n }, () => ({
        id: nextUuid(),
        name: 'report-execution',
        issued_by: issuedBy,
        period: JSON.stringify({}),
        deleted_at: null,
    }));
    if (rows.length) await knex('report_executions').insert(rows);
};

describe('KnexReportExecutionsRepository — reader wiring (Oleada 11)', () => {
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
        repo = new KnexReportExecutionsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexReportExecutionsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexReportExecutionsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const issuedBy = await seedUser(repo.writer);
        const baseline = num(await repo.count(stubCriteria));
        await seed(repo.writer, 2, issuedBy);

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

    it('save() marks the request as written', async () => {
        repo = new KnexReportExecutionsRepository(makeWriterConfig(), makeReaderConfig());
        const issuedBy = await seedUser(repo.writer);
        const stubToSave = { id: nextUuid(), name: 'n', issued_by: issuedBy, period: {}, status: 'pending' };

        const wrote = await DbRequestContext.run(async () => {
            try {
                await repo.save(stubToSave);
            } catch {
                // markWrite() fired before the insert.
            }
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
