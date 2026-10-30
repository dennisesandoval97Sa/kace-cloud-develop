import { ListPermissions } from '../../src/role/domain/ListPermissions.js';
import { RolePermisionList } from '../../../kace_cloud_database/utils/RolePermisionList.js';

// KTSS-3580: las páginas de Broker y sus Lambdas exigen BrokerAdapters* / BrokerMappers*. Si la semilla de
// roles no los trae, el administrador de un tenant nuevo no ve ninguna acción del módulo.
describe.each([
    ['broker_adapters', 'BrokerAdapters'],
    ['broker_mappers', 'BrokerMappers'],
    ['folio-configurations', 'FolioConfigurations'],
])('%s permissions', (moduleId, prefix) => {
    const PERMISSION_NAMES = ['Create', 'Update', 'Delete', 'Read'].map((action) => `${prefix}${action}`);

    const pickModulePermissions = (permissions) =>
        permissions
            .filter((permission) => permission.module_id === moduleId && PERMISSION_NAMES.includes(permission.name))
            .map(({ name, description, module_id }) => ({ name, description, module_id }));

    it('declares in the administrador role seed the same permissions as the domain catalog', () => {
        const catalog = pickModulePermissions(new ListPermissions().toPrimivites().administrador);

        expect(catalog).toHaveLength(PERMISSION_NAMES.length);
        expect(pickModulePermissions(RolePermisionList().administrador)).toEqual(catalog);
    });

    it('grants them to the seeded admin role', () => {
        const seeded = RolePermisionList(true).administrador.filter((permission) =>
            PERMISSION_NAMES.includes(permission.name)
        );

        expect(seeded).toHaveLength(PERMISSION_NAMES.length);
        expect(seeded.every((permission) => permission.granted)).toBe(true);
    });
});
