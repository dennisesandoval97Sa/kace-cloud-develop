import { ListPermissions } from '../../src/role/domain/ListPermissions.js';
import { RolePermisionList } from '../../../kace_cloud_database/utils/RolePermisionList.js';

// MSKT-1392 (F0-3a): `CaseReclassify` pasa a existir en los dos namespaces.
// El catálogo de dominio (ListPermissions) y la semilla de roles
// (RolePermisionList, en @kace/database, que no puede importar @kace/core) son
// espejos: añadirlo en uno sin el otro deja el permiso invisible en la UI de
// roles o ausente en los tenants nuevos. Este test los mantiene en lockstep.
describe('CaseReclassify permission', () => {
    const PERMISSION_NAME = 'CaseReclassify';
    const MODULE_ID = 'cases';
    const DESCRIPTION = 'Reclasificar caso';

    const catalog = new ListPermissions().toPrimivites();
    const seed = RolePermisionList();

    const findIn = (permissions) => permissions.filter((permission) => permission.name === PERMISSION_NAME);

    describe.each(['agente', 'administrador'])('namespace %s', (namespace) => {
        it('is declared once in the domain permission catalog', () => {
            const matches = findIn(catalog[namespace]);

            expect(matches).toHaveLength(1);
            expect(matches[0].module_id).toBe(MODULE_ID);
            expect(matches[0].description).toBe(DESCRIPTION);
        });

        it('is declared once in the role seed, not granted by default', () => {
            const matches = findIn(seed[namespace]);

            expect(matches).toHaveLength(1);
            expect(matches[0].module_id).toBe(MODULE_ID);
            expect(matches[0].description).toBe(DESCRIPTION);
            expect(matches[0].granted).toBe(false);
        });
    });
});
