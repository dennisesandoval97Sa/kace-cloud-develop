import { CanUseCapability } from '../../../../src/shared/domain/rules/CanUseCapability.js';

describe('CanUseCapability.check', () => {
    const permission = { namespaces: ['administrador', 'agente'], moduleId: 'cases', name: 'CaseReclassify' };

    it('accepts the permission granted in the first namespace', () => {
        const user = { hasPermission: (namespace) => namespace === 'administrador' };

        expect(CanUseCapability.check(user, permission)).toBe(true);
    });

    it('accepts the permission granted only in the second namespace', () => {
        const user = { hasPermission: (namespace) => namespace === 'agente' };

        expect(CanUseCapability.check(user, permission)).toBe(true);
    });

    it('rejects a user without the permission in any namespace', () => {
        const user = { hasPermission: () => false };

        expect(CanUseCapability.check(user, permission)).toBe(false);
    });

    it('treats hasPermission throwing (role not present) as "not granted", not as an error', () => {
        const user = {
            hasPermission: () => {
                throw new Error('user has no such role');
            },
        };

        expect(CanUseCapability.check(user, permission)).toBe(false);
    });

    it('checks the remaining namespaces even if an earlier one throws', () => {
        const user = {
            hasPermission: (namespace) => {
                if (namespace === 'administrador') throw new Error('no role');
                return namespace === 'agente';
            },
        };

        expect(CanUseCapability.check(user, permission)).toBe(true);
    });

    it('rejects a null user', () => {
        expect(CanUseCapability.check(null, permission)).toBe(false);
    });

    it('rejects a user without a hasPermission method', () => {
        expect(CanUseCapability.check({}, permission)).toBe(false);
    });

    it('rejects a malformed permission (empty namespaces)', () => {
        const user = { hasPermission: () => true };

        expect(CanUseCapability.check(user, { namespaces: [], moduleId: 'cases', name: 'X' })).toBe(false);
    });

    it('rejects a malformed permission (missing moduleId/name)', () => {
        const user = { hasPermission: () => true };

        expect(CanUseCapability.check(user, { namespaces: ['administrador'] })).toBe(false);
    });

    it('rejects a null permission', () => {
        const user = { hasPermission: () => true };

        expect(CanUseCapability.check(user, null)).toBe(false);
    });
});

describe('CanUseCapability.isWellFormed', () => {
    it('accepts a complete permission spec', () => {
        expect(
            CanUseCapability.isWellFormed({ namespaces: ['administrador'], moduleId: 'cases', name: 'CaseReclassify' })
        ).toBe(true);
    });

    it('rejects namespaces that are not a non-empty array', () => {
        expect(CanUseCapability.isWellFormed({ namespaces: [], moduleId: 'cases', name: 'X' })).toBe(false);
        expect(CanUseCapability.isWellFormed({ namespaces: 'administrador', moduleId: 'cases', name: 'X' })).toBe(
            false
        );
    });

    it('rejects a missing moduleId or name', () => {
        expect(CanUseCapability.isWellFormed({ namespaces: ['administrador'], name: 'X' })).toBe(false);
        expect(CanUseCapability.isWellFormed({ namespaces: ['administrador'], moduleId: 'cases' })).toBe(false);
    });

    it('rejects null/undefined', () => {
        expect(CanUseCapability.isWellFormed(null)).toBe(false);
        expect(CanUseCapability.isWellFormed(undefined)).toBe(false);
    });
});
