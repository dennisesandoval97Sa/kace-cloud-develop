import { test } from 'node:test';
import assert from 'node:assert/strict';

import { up, down } from '../../migrations/20261022120000_grant_folio_configuration_permissions_to_admin_roles.js';
import { RolePermisionList } from '../../utils/RolePermisionList.js';

const FOLIO_PERMISSION_NAMES = [
    'FolioConfigurationsCreate',
    'FolioConfigurationsUpdate',
    'FolioConfigurationsDelete',
    'FolioConfigurationsRead',
];

/**
 * In-memory stand-in for the two calls the migration makes on `roles`:
 * `knex('roles').select(...)` and `knex('roles').where({ id }).update({ permisos })`.
 * `permisos` is stored as the JSON string Postgres hands back for a jsonb column read as text.
 */
const createRolesTable = (rows) => {
    const roles = new Map(
        Object.entries(rows).map(([id, permisos]) => [id, permisos === null ? null : JSON.stringify(permisos)])
    );

    const knex = (table) => {
        assert.equal(table, 'roles');
        return {
            select: async () => [...roles].map(([id, permisos]) => ({ id, permisos })),
            where: ({ id }) => ({
                update: async ({ permisos }) => {
                    roles.set(id, permisos);
                },
            }),
        };
    };

    const permissionsOf = (id) => {
        const stored = roles.get(id);
        return stored === null ? null : JSON.parse(stored);
    };

    return { knex, permissionsOf };
};

const access = (granted) => ({
    name: 'Access',
    granted,
    module_id: 'access-admin',
    description: 'Acceso general modulo administrador',
});

const rolePermissions = (administrador = []) => ({
    agente: [],
    administrador,
    auxiliaries: [],
    search: [],
});

const folioEntries = (permissions) =>
    permissions.administrador.filter((permission) => FOLIO_PERMISSION_NAMES.includes(permission.name));

test('up grants the four folio permissions to a role with administrator access', async () => {
    const { knex, permissionsOf } = createRolesTable({ admin: rolePermissions([access(true)]) });

    await up(knex);

    const permissions = permissionsOf('admin');
    assert.deepEqual(
        folioEntries(permissions).map(({ name, granted }) => ({ name, granted })),
        FOLIO_PERMISSION_NAMES.map((name) => ({ name, granted: true }))
    );
    assert.deepEqual(permissions.administrador[0], access(true));
});

test('up leaves roles without granted administrator access untouched', async () => {
    const denied = rolePermissions([access(false)]);
    const withoutAccess = rolePermissions([
        { name: 'UsersRead', granted: true, module_id: 'users', description: 'Ver usuario' },
    ]);
    const { knex, permissionsOf } = createRolesTable({ 'access-denied': denied, 'no-access-entry': withoutAccess });

    await up(knex);

    assert.deepEqual(permissionsOf('access-denied'), denied);
    assert.deepEqual(permissionsOf('no-access-entry'), withoutAccess);
});

test('up keeps a folio permission already stored on the role, even when denied', async () => {
    const { knex, permissionsOf } = createRolesTable({
        admin: rolePermissions([
            access(true),
            { name: 'FolioConfigurationsDelete', granted: false, module_id: 'folio-configurations', description: 'x' },
        ]),
    });

    await up(knex);

    const entries = folioEntries(permissionsOf('admin'));
    const deletes = entries.filter((permission) => permission.name === 'FolioConfigurationsDelete');

    assert.equal(entries.length, FOLIO_PERMISSION_NAMES.length);
    assert.equal(deletes.length, 1);
    assert.equal(deletes[0].granted, false);
    assert.ok(entries.filter((permission) => permission.name !== 'FolioConfigurationsDelete').every((p) => p.granted));
});

test('up is idempotent', async () => {
    const { knex, permissionsOf } = createRolesTable({ admin: rolePermissions([access(true)]) });

    await up(knex);
    await up(knex);

    assert.equal(folioEntries(permissionsOf('admin')).length, FOLIO_PERMISSION_NAMES.length);
});

test('up skips rows without a usable administrador namespace', async () => {
    const { knex, permissionsOf } = createRolesTable({
        'role-null': null,
        'role-no-admin': { agente: [], auxiliaries: [], search: [] },
    });

    await up(knex);

    assert.equal(permissionsOf('role-null'), null);
    assert.equal(permissionsOf('role-no-admin').administrador, undefined);
});

test('down keeps the folio grants in place', async () => {
    const { knex, permissionsOf } = createRolesTable({ admin: rolePermissions([access(true)]) });

    await up(knex);
    await down(knex);

    assert.equal(folioEntries(permissionsOf('admin')).length, FOLIO_PERMISSION_NAMES.length);
});

test('up grants the same folio entries the role seed declares', async () => {
    const { knex, permissionsOf } = createRolesTable({ admin: rolePermissions([access(true)]) });

    await up(knex);

    const seeded = folioEntries(RolePermisionList(true));
    const granted = folioEntries(permissionsOf('admin'));

    assert.equal(seeded.length, FOLIO_PERMISSION_NAMES.length);
    assert.deepEqual(granted, seeded);
});
