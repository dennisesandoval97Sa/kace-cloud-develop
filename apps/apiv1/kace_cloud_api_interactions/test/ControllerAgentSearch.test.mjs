import { jest } from '@jest/globals';
import { executeInteractionSearch } from '../src/interaction-search-action.mjs';

const searchExecute = jest.fn();
const adminSearchExecute = jest.fn();
const authorize = jest.fn((_endpointKey, query) => query);
const activeGroupScopeFromUser = jest.fn((user) => ({
    userId: user.id.value,
    activeGroupId: user.grupo_activo.value,
}));
const repository = {};
const searcher = {
    execute: searchExecute,
    executeForAdminSearch: adminSearchExecute,
};
const createSearcher = jest.fn(() => searcher);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const query = {
    filter: [{ field: 'workspace_id', operator: 'eq', value: 'payload-workspace', type: 'AND' }],
    limit: 10,
    offset: 0,
};
const user = { id: { value: USER_ID }, grupo_activo: { value: GROUP_ID } };

const eventFor = (originalResource) => {
    const event = { resource: '/search' };
    if (originalResource) event.originalResource = originalResource;
    return event;
};

describe('interaction search action', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        searchExecute.mockResolvedValue({ toJson: () => ({ data: { items: [] }, metadata: { count: 0 } }) });
        adminSearchExecute.mockResolvedValue({ toJson: () => ({ data: { items: [] }, metadata: { count: 0 } }) });
    });

    const run = (originalResource) =>
        executeInteractionSearch({
            event: eventFor(originalResource),
            user,
            query,
            authorize,
            repository,
            createSearcher,
            activeGroupScopeFromUser,
        });

    it('passes server-derived active-group scope to Agent search regardless of payload workspace filters', async () => {
        await run('/agent/search');

        expect(authorize).toHaveBeenCalledWith('interactions.search', query);
        expect(searchExecute).toHaveBeenCalledWith(
            expect.objectContaining({
                filter: [expect.objectContaining({ field: 'workspace_id', value: 'payload-workspace' })],
            }),
            { userId: USER_ID, activeGroupId: GROUP_ID }
        );
        expect(adminSearchExecute).not.toHaveBeenCalled();
    });

    it('uses the dedicated Admin search path for the generic route', async () => {
        await run();

        expect(adminSearchExecute).toHaveBeenCalledWith(
            expect.objectContaining({
                filter: [expect.objectContaining({ field: 'workspace_id', value: 'payload-workspace' })],
            })
        );
        expect(searchExecute).not.toHaveBeenCalled();
    });
});
