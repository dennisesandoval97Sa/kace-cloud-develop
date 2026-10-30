import {
    ValueObjectPermissions,
    formatPermissionsWithAdminSearchDefaults,
    backfillPermissionsWithAdminSearchDefaults,
} from '../../src/role/domain/value-object/ValueObjectPermissions';
import { ListPermissions } from '../../src/role/domain/ListPermissions';

const perm = (module_id, name, granted) => ({ module_id, name, granted });
const find = (list, module_id, name) => list.find((p) => p.module_id === module_id && p.name === name);

const legacyRole = (overrides = {}) => ({
    agente: [perm('cases', 'CasesUpdate', true)],
    administrador: [perm('cases', 'CaseClose', true), perm('user-cases-assigment', 'UserCasesAssigmentCreate', false)],
    ...overrides,
});

describe('ValueObjectPermissions bulk inheritance', () => {
    describe('hasPermission', () => {
        it('inherits when the bulk permission is not stored', () => {
            const vo = new ValueObjectPermissions(legacyRole());
            expect(vo.hasPermission('administrador', 'cases', 'CasesBulkClose')).toBe(true);
            expect(vo.hasPermission('administrador', 'cases', 'CasesBulkTransition')).toBe(true);
            expect(vo.hasPermission('administrador', 'cases', 'CasesBulkAssign')).toBe(false);
        });

        it('uses the stored value over inheritance', () => {
            const vo = new ValueObjectPermissions(
                legacyRole({
                    administrador: [perm('cases', 'CaseClose', true), perm('cases', 'CasesBulkClose', false)],
                })
            );
            expect(vo.hasPermission('administrador', 'cases', 'CasesBulkClose')).toBe(false);
        });

        it('is false when neither the bulk nor the source permission is stored', () => {
            const vo = new ValueObjectPermissions({ agente: [], administrador: [] });
            expect(vo.hasPermission('administrador', 'cases', 'CasesBulkClose')).toBe(false);
        });

        it('keeps non-derived permissions unchanged', () => {
            const vo = new ValueObjectPermissions(legacyRole());
            expect(vo.hasPermission('administrador', 'cases', 'CaseClone')).toBe(false);
        });
    });

    describe('backfillPermissionsWithAdminSearchDefaults (login payload)', () => {
        it('adds missing bulk permissions with the inherited value', () => {
            const result = backfillPermissionsWithAdminSearchDefaults(
                legacyRole(),
                new ListPermissions().toPrimivites()
            );
            expect(find(result.administrador, 'cases', 'CasesBulkClose').granted).toBe(true);
            expect(find(result.administrador, 'cases', 'CasesBulkTransition').granted).toBe(true);
            expect(find(result.administrador, 'cases', 'CasesBulkAssign').granted).toBe(false);
        });

        it('does not override a stored bulk permission', () => {
            const stored = legacyRole({
                administrador: [perm('cases', 'CaseClose', true), perm('cases', 'CasesBulkClose', false)],
            });
            const result = backfillPermissionsWithAdminSearchDefaults(stored, new ListPermissions().toPrimivites());
            expect(find(result.administrador, 'cases', 'CasesBulkClose').granted).toBe(false);
        });
    });

    describe('formatPermissionsWithAdminSearchDefaults (persist / roles UI)', () => {
        it('fills missing bulk permissions with the inherited value', () => {
            const result = formatPermissionsWithAdminSearchDefaults(legacyRole(), new ListPermissions().permissions);
            expect(find(result.administrador, 'cases', 'CasesBulkClose').granted).toBe(true);
            expect(find(result.administrador, 'cases', 'CasesBulkAssign').granted).toBe(false);
        });

        it('freezes the inherited value on first save: revoking the source later no longer revokes the bulk permission', () => {
            const persisted = JSON.parse(new ValueObjectPermissions(legacyRole()).value);
            expect(find(persisted.administrador, 'cases', 'CasesBulkTransition').granted).toBe(true);

            const revokedSource = {
                ...persisted,
                agente: persisted.agente.map((p) => (p.name === 'CasesUpdate' ? { ...p, granted: false } : p)),
            };
            const vo = new ValueObjectPermissions(revokedSource);

            expect(vo.hasPermission('agente', 'cases', 'CasesUpdate')).toBe(false);
            expect(vo.hasPermission('administrador', 'cases', 'CasesBulkTransition')).toBe(true);
        });

        it('keeps following the source while the bulk permission has not been persisted', () => {
            const vo = new ValueObjectPermissions(legacyRole({ agente: [perm('cases', 'CasesUpdate', false)] }));

            expect(vo.hasPermission('administrador', 'cases', 'CasesBulkTransition')).toBe(false);
        });
    });
});
