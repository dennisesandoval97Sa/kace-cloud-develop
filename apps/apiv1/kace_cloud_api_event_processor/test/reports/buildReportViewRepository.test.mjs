import { buildReportViewRepository } from '../../src/reports/buildReportViewRepository.mjs';

// Fake tenant that mimics Tenant.buildKnexConfig(): distinct host for the reader role.
const makeTenant = (readerHost) => ({
    db_host_reader: { value: readerHost },
    buildKnexConfig: ({ preferReplica = false, role = 'writer' } = {}) => ({
        client: 'sqlite3',
        connection: {
            host: role === 'reader' && preferReplica ? 'reader.local' : 'writer.local',
            filename: ':memory:',
        },
        useNullAsDefault: true,
        pool: { min: 1, max: 1 },
        schema: '',
    }),
});

describe('buildReportViewRepository — reader wiring', () => {
    let repo;

    afterEach(async () => {
        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
    });

    it('opens a distinct reader pool when the tenant has a replica host', () => {
        repo = buildReportViewRepository(makeTenant('reader.local'));

        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool when the tenant has no replica host (fail-safe)', () => {
        repo = buildReportViewRepository(makeTenant(null));

        expect(repo.reader).toBe(repo.writer);
    });
});
