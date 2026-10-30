import { activeGroupScopeFromAuthenticatedUser } from '../../src/security/ActiveGroupScope.js';

describe('activeGroupScopeFromAuthenticatedUser', () => {
    it('extracts immutable scope inputs from value-object-backed authenticated user fields', () => {
        expect(
            activeGroupScopeFromAuthenticatedUser({
                id: { value: 'user-1' },
                grupo_activo: { value: 'group-1' },
            })
        ).toEqual({ userId: 'user-1', activeGroupId: 'group-1' });
    });

    it('supports primitive authenticated user fields and fails closed for missing fields', () => {
        expect(activeGroupScopeFromAuthenticatedUser({ id: 'user-2', grupo_activo: 'group-2' })).toEqual({
            userId: 'user-2',
            activeGroupId: 'group-2',
        });
        expect(activeGroupScopeFromAuthenticatedUser(null)).toEqual({ userId: null, activeGroupId: null });
    });
});
