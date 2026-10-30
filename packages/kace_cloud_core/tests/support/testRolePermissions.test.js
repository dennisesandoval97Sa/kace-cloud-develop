import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import Knex from 'knex';
import buildTemplateDatabase from './templateDatabase.js';
import { openAdminConnection, testServerCredentials } from './adminConnection.js';
import { buildGlobalRolePermissions, grantGlobalRolePermissions } from './testRolePermissions.js';

// Rol seedeado por 20241125105900_usuario_base.js (@kace/database). No se importa el
// modulo de seeds aqui para no acoplar este test a un import extra; el id es estable.
const GLOBAL_ROLE_ID = '3c48e5b0-d386-48e0-afaa-0fb47123a55c';

// Nombre deliberadamente fuera del esquema deterministico de dbNaming.js (kace_t_<hash>)
// para no colisionar con la base por-archivo que setupFilesAfterEnv asigna a este mismo
// archivo de test.
const CLONE_DATABASE_NAME = `role_perm_check_${randomUUID().replaceAll('-', '_')}`;

let admin;
let clone;
let templateRole;

beforeAll(async () => {
    // Auto-suficiente: no depende de que globalSetup ya haya corrido en esta invocacion.
    // Si la plantilla existe, esto es practicamente gratis (~0.5s).
    await buildTemplateDatabase();

    admin = openAdminConnection();
    await admin.raw(`CREATE DATABASE ${CLONE_DATABASE_NAME} TEMPLATE ${process.env.KACE_TEST_TEMPLATE_DB}`);

    clone = Knex({
        client: 'pg',
        connection: { ...testServerCredentials(), database: CLONE_DATABASE_NAME },
        pool: { min: 0, max: 2 },
    });

    // Estado tal y como sale de la plantilla, capturado ANTES de que ningun test lo mute.
    templateRole = await clone('roles').where({ id: GLOBAL_ROLE_ID }).first();
});

afterAll(async () => {
    if (clone) {
        await clone.destroy();
    }
    if (admin) {
        await admin.raw(`DROP DATABASE IF EXISTS ${CLONE_DATABASE_NAME}`);
        await admin.destroy();
    }
});

test('la plantilla ya viene con los permisos del rol global concedidos', () => {
    // Contrato nuevo: la concesion ocurre en globalSetup sobre la plantilla, no en
    // el beforeAll de cada archivo. Cualquier base clonada la hereda.
    const expected = buildGlobalRolePermissions();

    expect(templateRole.permisos.agente).toHaveLength(expected.agente.length);
    expect(templateRole.permisos.administrador).toHaveLength(expected.administrador.length);
    expect(templateRole.permisos.agente.every((permission) => permission.granted === true)).toBe(true);
    expect(templateRole.permisos.administrador.every((permission) => permission.granted === true)).toBe(true);
});

test('el catalogo del dominio tiene mas permisos que el seed, asi que la concesion no es decorativa', () => {
    const expected = buildGlobalRolePermissions();

    expect(expected.agente.length).toBeGreaterThan(15);
    expect(expected.administrador.length).toBeGreaterThan(248);
});

test('grantGlobalRolePermissions grants every agente/administrador permission on the global role', async () => {
    // Arrange: fuerza un estado "no concedido" conocido, sin depender de si el seed
    // ya trae los permisos en true por defecto (RolePermisionList(true) lo hace hoy,
    // lo que haria la asercion trivialmente verdadera sin esta preparacion).
    const seeded = await clone('roles').where({ id: GLOBAL_ROLE_ID }).first();
    const forcedFalse = seeded.permisos;
    forcedFalse.agente.forEach((permission) => {
        permission.granted = false;
    });
    forcedFalse.administrador.forEach((permission) => {
        permission.granted = false;
    });
    await clone('roles')
        .where({ id: GLOBAL_ROLE_ID })
        .update({ permisos: JSON.stringify(forcedFalse) });

    const beforeGrant = await clone('roles').where({ id: GLOBAL_ROLE_ID }).first();
    expect(beforeGrant.permisos.agente.every((permission) => permission.granted === false)).toBe(true);
    expect(beforeGrant.permisos.administrador.every((permission) => permission.granted === false)).toBe(true);

    // Act
    await grantGlobalRolePermissions(clone);

    // Assert
    const afterGrant = await clone('roles').where({ id: GLOBAL_ROLE_ID }).first();
    expect(afterGrant.permisos.agente.length).toBeGreaterThan(0);
    expect(afterGrant.permisos.agente.every((permission) => permission.granted === true)).toBe(true);
    expect(afterGrant.permisos.administrador.length).toBeGreaterThan(0);
    expect(afterGrant.permisos.administrador.every((permission) => permission.granted === true)).toBe(true);
});
