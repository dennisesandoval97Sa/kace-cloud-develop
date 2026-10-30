import { BoardResourcesCollectionResponse } from '../../src/boards/application/BoardResourcesCollectionResponse.js';

const buildBoardResources = (rows = []) => ({
    rows,
});

describe('BoardResourcesCollectionResponse', () => {
    it('usa countByStatus=[] por defecto cuando no se pasa', () => {
        const response = new BoardResourcesCollectionResponse(buildBoardResources(), 0, 1, 0);

        expect(response.toJson().metadata.countByStatus).toEqual([]);
    });

    it('omits countByAns from metadata when countByAns is null (default)', () => {
        const response = new BoardResourcesCollectionResponse(buildBoardResources(), 0, 1, 0, []);

        const json = response.toJson();

        expect(json.metadata).not.toHaveProperty('countByAns');
        expect(json.metadata).toEqual({
            current_page: 1,
            total_pages: 0,
            count: 0,
            countByStatus: [],
        });
    });

    it('includes countByAns in metadata when provided', () => {
        const countByAns = [
            { id: 1, count: 12 },
            { id: 2, count: 3 },
            { id: 3, count: 5 },
        ];

        const response = new BoardResourcesCollectionResponse(buildBoardResources(), 20, 1, 1, [], countByAns);

        const json = response.toJson();

        expect(json.metadata).toHaveProperty('countByAns', countByAns);
    });

    it('includes countByAns even when all buckets are zero', () => {
        const countByAns = [
            { id: 1, count: 0 },
            { id: 2, count: 0 },
            { id: 3, count: 0 },
        ];

        const response = new BoardResourcesCollectionResponse(buildBoardResources(), 0, 1, 0, [], countByAns);

        expect(response.toJson().metadata.countByAns).toEqual(countByAns);
    });
});
