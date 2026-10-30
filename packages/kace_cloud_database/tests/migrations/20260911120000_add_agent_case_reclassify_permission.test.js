import { test } from 'node:test';
import assert from 'node:assert/strict';

import knex from 'knex';

import { up, down } from '../../migrations/20260911120000_add_agent_case_reclassify_permission.js';

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

const agentePermissions = (agente = []) => ({
    agente,
    administrador: [{ name: 'CaseReclassify', granted: true, module_id: 'cases', description: 'Reclasificar caso' }],
    auxiliaries: [],
    search: [],
});

test('up adds CaseReclassify to the agente namespace with granted false', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(
            db,
            'role-1',
            agentePermissions([{ name: 'CasesCreate', granted: true, module_id: 'cases', description: 'Crear caso' }])
        );

        await up(db);

        const permissions = await getPermissions(db, 'role-1');
        const added = permissions.agente.find((permission) => permission.name === 'CaseReclassify');

        assert.deepEqual(added, {
            name: 'CaseReclassify',
            granted: false,
            module_id: 'cases',
            description: 'Reclasificar caso',
        });
        assert.ok(permissions.agente.some((permission) => permission.name === 'CasesCreate'));
    } finally {
        await db.destroy();
    }
});

test('up never grants the permission, not even to roles that can already update cases', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(
            db,
            'role-1',
            agentePermissions([
                { name: 'CasesUpdate', granted: true, module_id: 'cases', description: 'Actualizar caso' },
            ])
        );

        await up(db);

        const permissions = await getPermissions(db, 'role-1');
        assert.equal(permissions.agente.find((permission) => permission.name === 'CaseReclassify').granted, false);
    } finally {
        await db.destroy();
    }
});

test('up leaves the administrador namespace untouched', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(db, 'role-1', agentePermissions());

        await up(db);

        const permissions = await getPermissions(db, 'role-1');
        assert.equal(permissions.administrador.length, 1);
        assert.equal(permissions.administrador[0].granted, true);
    } finally {
        await db.destroy();
    }
});

test('up is idempotent and preserves an already granted agente permission', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(
            db,
            'role-1',
            agentePermissions([
                { name: 'CaseReclassify', granted: true, module_id: 'cases', description: 'Reclasificar caso' },
            ])
        );

        await up(db);
        await up(db);

        const permissions = await getPermissions(db, 'role-1');
        const matches = permissions.agente.filter((permission) => permission.name === 'CaseReclassify');

        assert.equal(matches.length, 1);
        assert.equal(matches[0].granted, true);
    } finally {
        await db.destroy();
    }
});

test('up skips rows without a usable agente namespace', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(db, 'role-null', null);
        await insertRole(db, 'role-no-agente', { administrador: [], auxiliaries: [], search: [] });

        await up(db);

        const roleWithoutAgente = await getPermissions(db, 'role-no-agente');

        assert.equal(await getPermissions(db, 'role-null'), null);
        assert.equal(roleWithoutAgente.agente, undefined);
    } finally {
        await db.destroy();
    }
});

test('down preserves an agente grant made by an admin after up() ran', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(
            db,
            'role-1',
            agentePermissions([{ name: 'CasesCreate', granted: true, module_id: 'cases', description: 'Crear caso' }])
        );

        await up(db);

        // Un administrador otorga el permiso desde la UI de roles después de la migración.
        const permissions = await getPermissions(db, 'role-1');
        const agente = permissions.agente.map((permission) =>
            permission.name === 'CaseReclassify' ? { ...permission, granted: true } : permission
        );
        await db('roles')
            .where({ id: 'role-1' })
            .update({ permisos: JSON.stringify({ ...permissions, agente }) });

        await down(db);

        const afterRollback = await getPermissions(db, 'role-1');
        const preserved = afterRollback.agente.find((permission) => permission.name === 'CaseReclassify');

        assert.ok(preserved, 'the admin-granted permission must survive a rollback');
        assert.equal(preserved.granted, true);
    } finally {
        await db.destroy();
    }
});

test('down removes the agente permission and leaves administrador intact', async () => {
    const db = await createTestDatabase();

    try {
        await insertRole(
            db,
            'role-1',
            agentePermissions([{ name: 'CasesCreate', granted: true, module_id: 'cases', description: 'Crear caso' }])
        );

        await up(db);
        await down(db);

        const permissions = await getPermissions(db, 'role-1');

        assert.equal(
            permissions.agente.some((permission) => permission.name === 'CaseReclassify'),
            false
        );
        assert.ok(permissions.agente.some((permission) => permission.name === 'CasesCreate'));
        assert.equal(permissions.administrador[0].name, 'CaseReclassify');
    } finally {
        await db.destroy();
    }
});
