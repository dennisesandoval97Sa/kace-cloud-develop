import { KnexReportsViewRepository } from '../../../../src/reports/infrastructure/persistence/KnexReportsViewRepository.js';
import { knexConfig } from '../../../knexfile.js';
import TestHelper from '../../../TestHelper.js';

describe('KnexReportsViewRepository integration (real PG)', () => {
    let repo;

    afterAll(async () => {
        if (repo) {
            await repo.destroyConnection();
        }
    });

    it('reuses a single pool when reader host == writer host and reads succeed through read facade', async () => {
        // Same config for writer and reader => single-pool reuse (no replica host in CI).
        repo = new KnexReportsViewRepository(knexConfig, knexConfig);

        expect(repo.reader).toBe(repo.writer);

        // getViewColumns (writer/metadata) works and returns column names for an existing table/view.
        const columns = await repo.getViewColumns('usuarios');
        expect(Array.isArray(columns)).toBe(true);
    });
});
