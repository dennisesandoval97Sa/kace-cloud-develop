import { ListPermissions } from '../../src/role/domain/ListPermissions';

const BULK_PERMISSIONS = [
    ['CasesBulkClose', 'Cerrar casos masivamente'],
    ['CasesBulkTransition', 'Cambiar estado de casos masivamente'],
    ['CasesBulkAssign', 'Asignar casos masivamente'],
];

describe('Cases bulk permissions catalog', () => {
    const admin = new ListPermissions().toPrimivites().administrador;

    it.each(BULK_PERMISSIONS)('declares administrador/cases/%s denied by default', (name, description) => {
        expect(admin).toContainEqual(
            expect.objectContaining({ name, description, module_id: 'cases', granted: false })
        );
    });

    it('declares each bulk permission once', () => {
        BULK_PERMISSIONS.forEach(([name]) => {
            expect(admin.filter((p) => p.module_id === 'cases' && p.name === name)).toHaveLength(1);
        });
    });
});
