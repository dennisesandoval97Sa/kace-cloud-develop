import { jest } from '@jest/globals';
import { KnexRepository, SchemaMetadataCache } from '../../../../src/shared';
import { knexConfig } from '../../../knexfile.js';

describe('SchemaMetadataCache Integration', () => {
    const repo = new KnexRepository(knexConfig);

    beforeEach(() => {
        SchemaMetadataCache.clear();
    });

    it('shares the cache across multiple repository instances backed by the same connection', async () => {
        const repo2 = new KnexRepository(repo.connection);

        const cols1 = await repo.getTableColumns('usuarios');
        const cols2 = await repo2.getTableColumns('usuarios');
        const cols3 = await repo.getTableColumns('usuarios');

        expect(cols1).toEqual(cols2);
        expect(cols2).toEqual(cols3);
        expect(cols1.length).toBeGreaterThan(0);
    });

    it('caches tableExists across calls and instances', async () => {
        const repo2 = new KnexRepository(repo.connection);

        const existsA = await repo.entityExists('usuarios');
        const existsB = await repo2.entityExists('usuarios');

        expect(existsA).toBe(true);
        expect(existsB).toBe(true);
    });
});
