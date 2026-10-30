import { BoardResources } from '../../src/boards/domain/BoardResources.js';
import { BoardResourcesCollectionResponse } from '../../src/boards/application/BoardResourcesCollectionResponse.js';

describe('empty board resources payload', () => {
    it('matches the active_client short-circuit body', () => {
        const json = new BoardResourcesCollectionResponse(new BoardResources([], 0), 0, 1, 1, []).toJson();
        expect(json).toEqual({
            data: { items: [] },
            metadata: { current_page: 1, total_pages: 1, count: 0, countByStatus: [] },
        });
    });
});
