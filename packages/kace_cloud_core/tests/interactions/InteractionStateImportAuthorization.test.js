import { jest } from '@jest/globals';
import {
    canImportInteractionState,
    importedInteractionStateValidationError,
} from '../../src/interactions/application/create/InteractionStateImportPolicy.js';

function userWithPermissions(...permissions) {
    return {
        hasPermission: jest.fn(
            (role, moduleId, permission) =>
                role === 'administrador' && moduleId === 'interactions' && permissions.includes(permission)
        ),
    };
}

describe('canImportInteractionState', () => {
    it('allows ordinary open interaction creation without state-changing permissions', () => {
        const user = userWithPermissions();

        expect(canImportInteractionState(user, { is_closed: false, in_review: false })).toBe(true);
        expect(user.hasPermission).not.toHaveBeenCalled();
    });

    it('rejects state flags without the migration marker', () => {
        const user = userWithPermissions('InteractionsBulkClose', 'InteractionsUpdate');

        expect(canImportInteractionState(user, { is_migrated: false, is_closed: true })).toBe(false);
        expect(user.hasPermission).not.toHaveBeenCalled();
    });

    it('requires the bulk-close permission for imported closed state', () => {
        const unauthorizedUser = userWithPermissions('InteractionsUpdate');
        const authorizedUser = userWithPermissions('InteractionsBulkClose');
        const payload = { is_migrated: true, is_closed: true };

        expect(canImportInteractionState(unauthorizedUser, payload)).toBe(false);
        expect(canImportInteractionState(authorizedUser, payload)).toBe(true);
    });

    it('requires the update permission for imported review state', () => {
        const unauthorizedUser = userWithPermissions('InteractionsBulkClose');
        const authorizedUser = userWithPermissions('InteractionsUpdate');
        const payload = { is_migrated: true, in_review: true };

        expect(canImportInteractionState(unauthorizedUser, payload)).toBe(false);
        expect(canImportInteractionState(authorizedUser, payload)).toBe(true);
    });

    it('enforces every state permission represented in a batch', () => {
        const user = userWithPermissions('InteractionsBulkClose');
        const payload = [
            { is_migrated: true, is_closed: true },
            { is_migrated: true, in_review: true },
        ];

        expect(canImportInteractionState(user, payload)).toBe(false);
        expect(user.hasPermission).toHaveBeenCalledWith('administrador', 'interactions', 'InteractionsBulkClose');
        expect(user.hasPermission).toHaveBeenCalledWith('administrador', 'interactions', 'InteractionsUpdate');
    });
});

describe('importedInteractionStateValidationError', () => {
    it('accepts coherent closed and review states', () => {
        expect(
            importedInteractionStateValidationError({
                is_migrated: true,
                is_closed: true,
                in_review: false,
                closed_at: new Date().toISOString(),
                closed_by: 'user-id',
            })
        ).toBeNull();
        expect(
            importedInteractionStateValidationError({
                is_migrated: true,
                is_closed: false,
                in_review: true,
                start_review_at: new Date().toISOString(),
                start_review_by: 'user-id',
            })
        ).toBeNull();
    });
});
