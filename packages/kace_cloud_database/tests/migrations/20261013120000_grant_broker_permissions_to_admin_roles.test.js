import { test } from 'node:test';
import assert from 'node:assert/strict';

import knex from 'knex';

import { up, down } from '../../migrations/20261013120000_grant_broker_permissions_to_admin_roles.js';
import { RolePermisionList } from '../../utils/RolePermisionList.js';

const BROKER_PERMISSION_NAMES = [
    'BrokerAdaptersCreate',
    'BrokerAdaptersUpdate',
    'BrokerAdaptersDelete',
    'BrokerAdaptersRead',
    'BrokerMappersCreate',
    'BrokerMappersUpdate',
    'BrokerMappersDelete',
    'BrokerMappersRead',
];

const createTestDatabase = async () => {
    const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
    });

    await db.schema.createTable('roles', (table) => {
        table.string('id', 36).primary();
        table.jsonb('permisos');
    });

    return db;
};

const insertRole = async (db, id, permisos) => {
    await db('roles').insert({ id, permisos: permisos === null ? null : JSON.stringify(permisos) });
};

const getPermissions = async (db, id) => {
    const row = await db('roles').where({ id }).first('permisos');
    if (row.permisos === null) {
        return null;
    }
    return typeof row.permisos === 'string' ? JSON.parse(row.permisos) : row.permisos;
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

const brokerEntries = (permissions) =>
    permissions.administrador.filter((permission) => BROKER_PERMISSION_NAMES.includes(permission.name));

test('up grants the eight broker permissions to a role with administrator access', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(db, 'admin', rolePermissions([access(true)]));

        await up(db);

        const permissions = await getPermissions(db, 'admin');

        assert.deepEqual(
            brokerEntries(permissions).map(({ name, granted }) => ({ name, granted })),
            BROKER_PERMISSION_NAMES.map((name) => ({ name, granted: true }))
        );
        assert.deepEqual(
            permissions.administrador.find((permission) => permission.name === 'BrokerMappersRead'),
            {
                name: 'BrokerMappersRead',
                granted: true,
                module_id: 'broker_mappers',
                description: 'Ver mapa',
            }
        );
        assert.deepEqual(permissions.administrador[0], access(true));
    } finally {
        await db.destroy();
    }
});

test('up leaves roles without granted administrator access untouched', async () => {
    const db = await createTestDatabase();

    try {
        const denied = rolePermissions([access(false)]);
        const withoutAccess = rolePermissions([
            { name: 'UsersRead', granted: true, module_id: 'users', description: 'Ver usuario' },
        ]);
        await insertRole(db, 'access-denied', denied);
        await insertRole(db, 'no-access-entry', withoutAccess);

        await up(db);

        assert.deepEqual(await getPermissions(db, 'access-denied'), denied);
        assert.deepEqual(await getPermissions(db, 'no-access-entry'), withoutAccess);
    } finally {
        await db.destroy();
    }
});

test('up keeps a broker permission already stored on the role, even when denied', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(
            db,
            'admin',
            rolePermissions([
                access(true),
                { name: 'BrokerAdaptersDelete', granted: false, module_id: 'broker_adapters', description: 'x' },
            ])
        );

        await up(db);

        const entries = brokerEntries(await getPermissions(db, 'admin'));
        const deletes = entries.filter((permission) => permission.name === 'BrokerAdaptersDelete');

        assert.equal(entries.length, BROKER_PERMISSION_NAMES.length);
        assert.equal(deletes.length, 1);
        assert.equal(deletes[0].granted, false);
        assert.ok(
            entries.filter((permission) => permission.name !== 'BrokerAdaptersDelete').every((p) => p.granted === true)
        );
    } finally {
        await db.destroy();
    }
});

test('up is idempotent', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(db, 'admin', rolePermissions([access(true)]));

        await up(db);
        await up(db);

        assert.equal(brokerEntries(await getPermissions(db, 'admin')).length, BROKER_PERMISSION_NAMES.length);
    } finally {
        await db.destroy();
    }
});

test('up skips rows without a usable administrador namespace', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(db, 'role-null', null);
        await insertRole(db, 'role-no-admin', { agente: [], auxiliaries: [], search: [] });

        await up(db);

        assert.equal(await getPermissions(db, 'role-null'), null);
        assert.equal((await getPermissions(db, 'role-no-admin')).administrador, undefined);
    } finally {
        await db.destroy();
    }
});

test('down keeps the broker grants in place', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(db, 'admin', rolePermissions([access(true)]));

        await up(db);
        await down(db);

        assert.equal(brokerEntries(await getPermissions(db, 'admin')).length, BROKER_PERMISSION_NAMES.length);
    } finally {
        await db.destroy();
    }
});

test('up grants the same broker entries the role seed declares', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(db, 'admin', rolePermissions([access(true)]));

        await up(db);

        const seeded = brokerEntries(RolePermisionList(true));
        const granted = brokerEntries(await getPermissions(db, 'admin'));

        assert.equal(seeded.length, BROKER_PERMISSION_NAMES.length);
        assert.deepEqual(granted, seeded);
    } finally {
        await db.destroy();
    }
});
