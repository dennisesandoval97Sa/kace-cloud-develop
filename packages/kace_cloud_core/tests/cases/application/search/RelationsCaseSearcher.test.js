import { RelationsCaseSearcher } from '../../../../src/cases/application/search/RelationsCaseSearcher.js';
import { MAX_PAGE_SIZE } from '../../../../src/cases/application/search/clampPageSize.js';

const makeRepository = () => {
    const captured = {};
    return {
        captured,
        tableName: 'cases',
        async searchWithAllRelations(criteria) {
            captured.dataLimit = criteria.limit;
            return [];
        },
        async searchCount(criteria) {
            try {
                captured.countLimit = criteria.limit;
            } catch (error) {
                captured.countLimit = null;
            }
            return { count: 0 };
        },
    };
};

describe('RelationsCaseSearcher pagination cap', () => {
    it('caps the data criteria limit to MAX_PAGE_SIZE when client sends null', async () => {
        // Arrange
        const repository = makeRepository();
        const searcher = new RelationsCaseSearcher(repository);

        // Act
        await searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: null,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        // Assert
        expect(repository.captured.dataLimit).toBe(MAX_PAGE_SIZE);
    });

    it('caps a limit greater than the max', async () => {
        const repository = makeRepository();
        const searcher = new RelationsCaseSearcher(repository);

        await searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: 67191,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        expect(repository.captured.dataLimit).toBe(MAX_PAGE_SIZE);
    });

    it('preserves a valid limit within range', async () => {
        const repository = makeRepository();
        const searcher = new RelationsCaseSearcher(repository);

        await searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: 25,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        expect(repository.captured.dataLimit).toBe(25);
    });

    it('does not paginate the count criteria (count limit stays null)', async () => {
        // Arrange
        const repository = makeRepository();
        const searcher = new RelationsCaseSearcher(repository);

        // Act
        await searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: 67191,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        // Assert
        expect(repository.captured.countLimit).toBeNull();
    });
});
