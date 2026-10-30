import { ListPermissions } from '../../src/role/domain/ListPermissions.js';
import {
    backfillPermissionsWithAdminSearchDefaults,
    ValueObjectPermissions,
} from '../../src/role/domain/value-object/ValueObjectPermissions.js';
import { User } from '../../src/users/domain/User.js';
import { SearchPermissionsCatalog } from '../../src/role/domain/SearchPermissionsCatalog.js';
import { searchPolicies } from '../../../kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js';
import { RolePermisionList } from '../../../kace_cloud_database/utils/RolePermisionList.js';

describe('search permissions category', () => {
    const userDto = (permissions) => ({
        id: '11111111-1111-4111-8111-111111111111',
        login: 'admin@example.com',
        nombres: 'Admin',
        email: 'admin@example.com',
        is_active: 1,
        rol_id: '22222222-2222-4222-8222-222222222222',
        created_at: '2026-04-30T00:00:00.000Z',
        created_by: '33333333-3333-4333-8333-333333333333',
        permissions,
    });

    it('is included in the canonical permission list', () => {
        const permissions = new ListPermissions().toPrimivites();

        expect(permissions.search.some((permission) => permission.name === 'ClientsSearchAdvanced')).toBe(true);
        expect(permissions.search.some((permission) => permission.name === 'CasesSearchAdvanced')).toBe(true);
    });

    it('validates and formats search permissions', () => {
        const valueObject = new ValueObjectPermissions({
            agente: [],
            administrador: [],
            auxiliaries: [],
            search: [
                {
                    module_id: 'clients',
                    name: 'ClientsSearchAdvanced',
                    description: 'Use advanced search filters on clients.search',
                    granted: true,
                },
            ],
        });

        const parsed = JSON.parse(valueObject.value);
        expect(parsed.search.find((permission) => permission.name === 'ClientsSearchAdvanced').granted).toBe(true);
    });

    it('checks search permission through the user helper', () => {
        const user = new User(
            userDto({
                agente: [],
                administrador: [],
                auxiliaries: [],
                search: [
                    {
                        module_id: 'clients',
                        name: 'ClientsSearchAdvanced',
                        description: 'Use advanced search filters on clients.search',
                        granted: true,
                    },
                ],
            })
        );

        expect(user.hasSearchPermission('clients', 'ClientsSearchAdvanced')).toBe(true);
    });

    it('defaults legacy administrator users without a search category to advanced search access at runtime', () => {
        const user = new User(
            userDto({
                administrador: [
                    {
                        module_id: 'access-admin',
                        name: 'Access',
                        description: 'Acceso administrador',
                        granted: true,
                    },
                ],
            })
        );

        expect(user.hasSearchPermission('clients', 'ClientsSearchAdvanced')).toBe(true);
    });

    it('preserves explicit runtime advanced search denies for administrator users', () => {
        const user = new User(
            userDto({
                administrador: [
                    {
                        module_id: 'access-admin',
                        name: 'Access',
                        description: 'Acceso administrador',
                        granted: true,
                    },
                ],
                search: [
                    {
                        module_id: 'clients',
                        name: 'ClientsSearchAdvanced',
                        description: 'Use advanced search filters on clients.search',
                        granted: false,
                    },
                ],
            })
        );

        expect(user.hasSearchPermission('clients', 'ClientsSearchAdvanced')).toBe(false);
    });

    it('keeps runtime advanced search denied when administrator access is not granted', () => {
        const deniedAdminUser = new User(
            userDto({
                administrador: [
                    {
                        module_id: 'access-admin',
                        name: 'Access',
                        description: 'Acceso administrador',
                        granted: false,
                    },
                ],
            })
        );
        const nonAdminUser = new User(
            userDto({
                agente: [
                    {
                        module_id: 'access-agent',
                        name: 'Access',
                        description: 'Acceso agente',
                        granted: true,
                    },
                ],
            })
        );

        expect(deniedAdminUser.hasSearchPermission('clients', 'ClientsSearchAdvanced')).toBe(false);
        expect(nonAdminUser.hasSearchPermission('clients', 'ClientsSearchAdvanced')).toBe(false);
    });

    it('returns false instead of throwing when user has no search permissions category', () => {
        const user = new User({
            id: '44444444-4444-4444-8444-444444444444',
            login: 'legacy@example.com',
            nombres: 'Legacy',
            email: 'legacy@example.com',
            is_active: 1,
            rol_id: '55555555-5555-4555-8555-555555555555',
            created_at: '2026-04-30T00:00:00.000Z',
            created_by: '66666666-6666-4666-8666-666666666666',
            permissions: {
                agente: [],
                administrador: [],
                auxiliaries: [],
            },
        });

        expect(() => user.hasSearchPermission('clients', 'ClientsSearchAdvanced')).not.toThrow();
        expect(user.hasSearchPermission('clients', 'ClientsSearchAdvanced')).toBe(false);
    });

    it('formats empty permissions with canonical categories including search', () => {
        const parsed = JSON.parse(new ValueObjectPermissions({}).value);

        expect(Array.isArray(parsed.agente)).toBe(true);
        expect(Array.isArray(parsed.administrador)).toBe(true);
        expect(Array.isArray(parsed.auxiliaries)).toBe(true);
        expect(parsed.search.some((permission) => permission.name === 'ClientsSearchAdvanced')).toBe(true);
    });

    it('defaults missing advanced search permissions to granted for administrator roles', () => {
        const parsed = JSON.parse(
            new ValueObjectPermissions({
                administrador: [
                    {
                        module_id: 'access-admin',
                        name: 'Access',
                        description: 'Acceso administrador',
                        granted: true,
                    },
                ],
            }).value
        );

        expect(parsed.search.find((permission) => permission.name === 'ClientsSearchAdvanced').granted).toBe(true);
    });

    it('keeps missing advanced search permissions denied for non-administrator roles', () => {
        const parsedWithDeniedAdminAccess = JSON.parse(
            new ValueObjectPermissions({
                administrador: [
                    {
                        module_id: 'access-admin',
                        name: 'Access',
                        description: 'Acceso administrador',
                        granted: false,
                    },
                ],
            }).value
        );
        const parsedWithoutAdminAccess = JSON.parse(
            new ValueObjectPermissions({
                agente: [
                    {
                        module_id: 'access-agent',
                        name: 'Access',
                        description: 'Acceso agente',
                        granted: true,
                    },
                ],
            }).value
        );

        expect(
            parsedWithDeniedAdminAccess.search.find((permission) => permission.name === 'ClientsSearchAdvanced').granted
        ).toBe(false);
        expect(
            parsedWithoutAdminAccess.search.find((permission) => permission.name === 'ClientsSearchAdvanced').granted
        ).toBe(false);
    });

    it('preserves explicit denied advanced search permissions for administrator roles', () => {
        const parsed = JSON.parse(
            new ValueObjectPermissions({
                administrador: [
                    {
                        module_id: 'access-admin',
                        name: 'Access',
                        description: 'Acceso administrador',
                        granted: true,
                    },
                ],
                search: [
                    {
                        module_id: 'clients',
                        name: 'ClientsSearchAdvanced',
                        description: 'Use advanced search filters on clients.search',
                        granted: false,
                    },
                ],
            }).value
        );

        expect(parsed.search.find((permission) => permission.name === 'ClientsSearchAdvanced').granted).toBe(false);
        expect(parsed.search.find((permission) => permission.name === 'CasesSearchAdvanced').granted).toBe(true);
    });

    it('backfills missing advanced search permissions as granted for administrator auth payloads', () => {
        const backfilled = backfillPermissionsWithAdminSearchDefaults(
            {
                administrador: [
                    {
                        module_id: 'access-admin',
                        name: 'Access',
                        description: 'Acceso administrador',
                        granted: true,
                    },
                ],
                search: [
                    {
                        module_id: 'clients',
                        name: 'ClientsSearchAdvanced',
                        description: 'Use advanced search filters on clients.search',
                        granted: false,
                    },
                ],
            },
            new ListPermissions().toPrimivites()
        );

        expect(backfilled.search.find((permission) => permission.name === 'ClientsSearchAdvanced').granted).toBe(false);
        expect(backfilled.search.find((permission) => permission.name === 'CasesSearchAdvanced').granted).toBe(true);
    });

    it('rejects search permissions with a valid name but wrong module', () => {
        expect(
            () =>
                new ValueObjectPermissions({
                    search: [
                        {
                            module_id: 'wrong',
                            name: 'ClientsSearchAdvanced',
                            description: 'x',
                            granted: true,
                        },
                    ],
                })
        ).toThrow();
    });

    it('validates the seeded administrator permission list', () => {
        expect(() => new ValueObjectPermissions(RolePermisionList(true))).not.toThrow();
    });

    it('defines one catalog permission for every distinct search policy permission', () => {
        const policyPermissions = searchPolicies.map(({ advancedPermission }) => ({
            module_id: advancedPermission.module_id,
            name: advancedPermission.name,
        }));
        const distinctPolicyPermissionKeys = [
            ...new Set(policyPermissions.map(({ module_id, name }) => `${module_id}:${name}`)),
        ];
        const catalogPermissionKeys = SearchPermissionsCatalog.definitions().map(
            ({ module_id, name }) => `${module_id}:${name}`
        );

        expect(catalogPermissionKeys.sort()).toEqual(distinctPolicyPermissionKeys.sort());
        expect(new Set(catalogPermissionKeys).size).toBe(catalogPermissionKeys.length);
    });

    it('database seed search permissions match the core catalog exactly', () => {
        const catalogKeys = SearchPermissionsCatalog.definitions()
            .map((p) => `${p.module_id}:${p.name}`)
            .sort();
        const seedSearch = RolePermisionList(false).search || [];
        const seedKeys = seedSearch.map((p) => `${p.module_id}:${p.name}`).sort();
        expect(seedKeys).toEqual(catalogKeys);
    });
});
