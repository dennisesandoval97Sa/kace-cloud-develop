import { jest } from '@jest/globals';
import { ImportsDashboardSearcher } from '../../src/imports/application/imports-dashboard/search/ImportsDashboardSearcher.js';
import { UnfilteredCounter } from '../../src/imports/domain/UnfilteredCounter.js';
import { ImportsDashboardSearchResponse } from '../../src/imports/application/ImportsDashboardSearchResponse.js';

// ImportsDashboardSearcherIntegration.test.js already exercises the real-DB path end to end
// (where UnfilteredCounter naturally returns a `{ count }` row from Postgres). The `count['count(*)']`
// fallback exists for a differently-shaped result row that the real counter never actually
// produces, so it can only be reached by controlling UnfilteredCounter's return value directly.
describe('ImportsDashboardSearcher — count(*) fallback', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('falls back to count["count(*)"] when the counter result has no "count" key', async () => {
        jest.spyOn(UnfilteredCounter.prototype, 'execute').mockResolvedValueOnce({ 'count(*)': '7' });
        const repository = {
            tableName: 's3_import_files',
            search: jest.fn().mockResolvedValue([]),
        };
        const searcher = new ImportsDashboardSearcher(repository);

        const result = await searcher.execute({ filter: [], relationship: null, limit: 10, offset: 0 });

        expect(result).toBeInstanceOf(ImportsDashboardSearchResponse);
        expect(result.counter).toBe('7');
    });
});
