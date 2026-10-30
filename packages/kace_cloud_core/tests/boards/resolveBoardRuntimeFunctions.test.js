import { resolveBoardRuntimeFunctions } from '../../src/boards/domain/resolveBoardRuntimeFunctions.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GROUP_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const clientItem = {
    entity: 'cases',
    field: 'cliente_id',
    operator: 'eq',
    type: 'and',
    function_type: 'active_client',
    value: '',
};

const groupItem = {
    entity: 'cases',
    field: 'grupo_id',
    operator: 'eq',
    type: 'and',
    function_type: 'logged_in_user_group',
    value: '',
};

describe('resolveBoardRuntimeFunctions', () => {
    it('returns ok without rewriting items when no runtime function is present', () => {
        const items = [{ entity: 'cases', field: 'status', operator: 'eq', value: 'open', type: 'and' }];
        const result = resolveBoardRuntimeFunctions({
            items,
            userId: USER_ID,
            userGroup: GROUP_ID,
            rawActiveClient: CLIENT_ID,
        });
        expect(result).toEqual({ kind: 'ok', items });
        expect(result.items).not.toBe(items);
        expect(result.items[0].value).toBe('open');
    });

    it('returns empty when active_client is configured and the query param is missing', () => {
        const result = resolveBoardRuntimeFunctions({
            items: [clientItem],
            userId: USER_ID,
            userGroup: GROUP_ID,
            rawActiveClient: undefined,
        });
        expect(result).toEqual({ kind: 'empty' });
    });

    it('returns empty when active_client is configured and the query param is not a UUID', () => {
        const result = resolveBoardRuntimeFunctions({
            items: [clientItem],
            userId: USER_ID,
            userGroup: GROUP_ID,
            rawActiveClient: 'not-a-uuid',
        });
        expect(result).toEqual({ kind: 'empty' });
    });

    it('sets active_client item.value to the parsed UUID', () => {
        const result = resolveBoardRuntimeFunctions({
            items: [clientItem],
            userId: USER_ID,
            userGroup: GROUP_ID,
            rawActiveClient: `  ${CLIENT_ID}  `,
        });
        expect(result.kind).toBe('ok');
        expect(result.items[0].value).toBe(CLIENT_ID);
        expect(clientItem.value).toBe('');
    });

    it('returns missing_active_group before empty when both functions are configured and group is missing', () => {
        const result = resolveBoardRuntimeFunctions({
            items: [groupItem, clientItem],
            userId: USER_ID,
            userGroup: '',
            rawActiveClient: undefined,
        });
        expect(result).toEqual({ kind: 'missing_active_group' });
    });

    it('returns empty when group is present but active_client has no UUID', () => {
        const result = resolveBoardRuntimeFunctions({
            items: [groupItem, clientItem],
            userId: USER_ID,
            userGroup: GROUP_ID,
            rawActiveClient: undefined,
        });
        expect(result).toEqual({ kind: 'empty' });
    });

    it('resolves logged_in_user and logged_in_user_group together with active_client', () => {
        const result = resolveBoardRuntimeFunctions({
            items: [
                { field: 'responsable_id', function_type: 'logged_in_user', value: '', type: 'and' },
                groupItem,
                clientItem,
            ],
            userId: USER_ID,
            userGroup: GROUP_ID,
            rawActiveClient: CLIENT_ID,
        });
        expect(result.kind).toBe('ok');
        expect(result.items.map((item) => item.value)).toEqual([USER_ID, GROUP_ID, CLIENT_ID]);
    });

    it('treats a missing items array as an empty list', () => {
        const result = resolveBoardRuntimeFunctions({
            items: undefined,
            userId: USER_ID,
            userGroup: GROUP_ID,
            rawActiveClient: undefined,
        });
        expect(result).toEqual({ kind: 'ok', items: [] });
    });
});
