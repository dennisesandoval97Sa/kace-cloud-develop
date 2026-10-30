import knexLib from 'knex';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { ConfiguredViewCaseRepositoryFactory } from '../../../../src/cases/application/view-resolver/ConfiguredViewCaseRepositoryFactory.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const makeGlobalConfig = (customViewName) => ({
    settings: { layouts: { getConfig: () => (customViewName ? { custom_view_name: customViewName } : {}) } },
});

// globalConfig stub: getConfig returns no custom_view_name → resolver falls back to default view.
const globalConfigStub = makeGlobalConfig(null);

// view_case_details exists as a real view in the migrated schema (see tests/knexfile.js —
// every test file gets its own cloned postgres database), so the resolver's
// `SELECT 1 FROM view_case_details LIMIT 1` probe is satisfied without an ad-hoc fixture.
describe('ConfiguredViewCaseRepositoryFactory — reader wiring', () => {
    let writerInstance;
    let repo;

    beforeEach(() => {
        writerInstance = knexLib(makeWriterConfig());
    });

    afterEach(async () => {
        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
        if (writerInstance) {
            await writerInstance.destroy();
            writerInstance = undefined;
        }
    });

    it('builds a repo with a separate reader pool when knexConfig + readerConfig are provided', async () => {
        const factory = new ConfiguredViewCaseRepositoryFactory(writerInstance, {
            knexConfig: makeWriterConfig(),
            readerConfig: makeReaderConfig(),
        });

        repo = await factory.create(globalConfigStub);

        expect(repo.reader).not.toBe(repo.writer);
    });

    it('is backward-compatible: with only a connection, reader aliases writer (current behavior)', async () => {
        const factory = new ConfiguredViewCaseRepositoryFactory(writerInstance);

        repo = await factory.create(globalConfigStub);

        expect(repo.reader).toBe(repo.writer);
    });
});

describe('ConfiguredViewCaseRepositoryFactory — matview prefix fallback', () => {
    let db;
    let repo;

    beforeEach(() => {
        db = knexLib(makeWriterConfig());
    });

    afterEach(async () => {
        // The per-file database is shared across every `it()` in this file (cloned once in
        // beforeAll, see tests/knexfile.js), so the ad-hoc mv_view_casos_ans_counts fixture
        // from the test below must not leak into the "not created yet" fallback test. Drop it
        // before destroying the connection: `repo` is built directly from `db` (no separate
        // knexConfig), so repo.destroyConnection() tears down `db` itself.
        await db.schema.dropTableIfExists('mv_view_casos_ans_counts');
        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        } else {
            await db.destroy();
        }
    });

    it('uses mv_dashboard prefix for the default view without probing the DB', async () => {
        const factory = new ConfiguredViewCaseRepositoryFactory(db);
        repo = await factory.create(globalConfigStub);
        expect(repo.matviewPrefix).toBe('mv_dashboard');
    });

    // mv_view_casos_ans_counts/mv_dashboard_ans_counts are per-tenant dynamic materialized
    // views (built lazily when a tenant defines a custom cases view) with no counterpart in
    // the base migrated schema — kept as explicit fixtures, translated to postgres types.
    // view_casos, unlike its MVs, is a real view already present in the migrated schema.
    it('uses the custom prefix when the custom view and its mv_*_ans_counts MV both exist', async () => {
        await db.schema.createTable('mv_view_casos_ans_counts', (t) => {
            t.integer('pending');
            t.integer('to_overcome');
            t.integer('defeated');
            t.integer('managed');
        });
        await db('mv_view_casos_ans_counts').insert({ pending: 5, to_overcome: 0, defeated: 0, managed: 0 });

        const factory = new ConfiguredViewCaseRepositoryFactory(db);
        repo = await factory.create(makeGlobalConfig('view_casos'));

        const result = await repo.getAnsCountsFromView();
        expect(repo.matviewPrefix).toBe('mv_view_casos');
        expect(result.pending).toBe(5);
    });

    it('falls back to mv_dashboard when the custom view exists but its MVs have not been created yet', async () => {
        // mv_view_casos_ans_counts deliberately NOT created — simulates a manually-created
        // view whose materialized views were never built (the production scenario that caused 500s).
        // The fallback mv_dashboard_ans_counts is a REAL materialized view in the migrated
        // schema (unlike mv_view_casos_ans_counts, which is genuinely per-tenant/dynamic) — a
        // real matview cannot be seeded via direct INSERT, so this asserts against its actual
        // baseline content (all zero counts) rather than fabricated data.
        const factory = new ConfiguredViewCaseRepositoryFactory(db);
        repo = await factory.create(makeGlobalConfig('view_casos'));

        const result = await repo.getAnsCountsFromView();
        expect(repo.matviewPrefix).toBe('mv_dashboard');
        expect(result.pending).toBe(0);
    });
});
