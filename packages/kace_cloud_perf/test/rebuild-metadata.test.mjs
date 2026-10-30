import { jest } from '@jest/globals';

import { aggregateSubCatalogs } from '../runner/rebuild-metadata.mjs';

describe('aggregateSubCatalogs', () => {
    it('flattens scenarios from multiple sub-catalogs', () => {
        const masterCatalog = {
            phase: 'F2-R',
            subCatalogs: ['phase2-read-cases.json', 'phase2-read-users-config.json'],
        };
        const subLoader = jest.fn((path) => {
            if (path.includes('cases')) return { scenarios: [{ id: 'a' }, { id: 'b' }] };
            if (path.includes('users')) return { scenarios: [{ id: 'c' }] };
            return null;
        });

        const result = aggregateSubCatalogs(masterCatalog, '/catalogs', subLoader);

        expect(result).toHaveLength(3);
        expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    });

    it('deduplicates by scenario id (last wins)', () => {
        const masterCatalog = { subCatalogs: ['a.json', 'b.json'] };
        const subLoader = jest.fn((path) => {
            if (path.endsWith('a.json')) return { scenarios: [{ id: 'x', service: 'old' }] };
            return { scenarios: [{ id: 'x', service: 'new' }] };
        });

        const result = aggregateSubCatalogs(masterCatalog, '/catalogs', subLoader);

        expect(result).toHaveLength(1);
        expect(result[0].service).toBe('new');
    });

    it('returns empty array when subCatalogs is missing', () => {
        const result = aggregateSubCatalogs({ phase: 'X' }, '/catalogs', () => null);
        expect(result).toEqual([]);
    });
});
