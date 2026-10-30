import { resolveInheritedGranted } from '../../src/role/domain/DerivedPermissionDefaults';

const perm = (module_id, name, granted) => ({ module_id, name, granted });

describe('resolveInheritedGranted', () => {
    it.each([
        ['CasesBulkClose', 'administrador', 'cases', 'CaseClose'],
        ['CasesBulkTransition', 'agente', 'cases', 'CasesUpdate'],
        ['CasesBulkAssign', 'administrador', 'user-cases-assigment', 'UserCasesAssigmentCreate'],
    ])('%s inherits from %s/%s/%s', (target, sourceRole, sourceModule, sourceName) => {
        const granted = { [sourceRole]: [perm(sourceModule, sourceName, true)] };
        const denied = { [sourceRole]: [perm(sourceModule, sourceName, false)] };

        expect(resolveInheritedGranted('administrador', perm('cases', target), granted)).toBe(true);
        expect(resolveInheritedGranted('administrador', perm('cases', target), denied)).toBe(false);
    });

    it('returns undefined for an unmapped permission', () => {
        const stored = { administrador: [perm('cases', 'CaseClose', true)] };
        expect(resolveInheritedGranted('administrador', perm('cases', 'CaseClone'), stored)).toBeUndefined();
    });

    it('returns undefined when the source permission is not stored', () => {
        expect(
            resolveInheritedGranted('administrador', perm('cases', 'CasesBulkClose'), { administrador: [] })
        ).toBeUndefined();
    });

    it('returns undefined when the source role key is missing', () => {
        expect(
            resolveInheritedGranted('administrador', perm('cases', 'CasesBulkTransition'), { administrador: [] })
        ).toBeUndefined();
    });

    it('does not inherit for the same name under another role', () => {
        const stored = { administrador: [perm('cases', 'CaseClose', true)] };
        expect(resolveInheritedGranted('agente', perm('cases', 'CasesBulkClose'), stored)).toBeUndefined();
    });
});
