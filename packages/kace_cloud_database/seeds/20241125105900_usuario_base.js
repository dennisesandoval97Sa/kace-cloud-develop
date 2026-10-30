import { v4 as uuidv4 } from 'uuid';
import { RolePermisionList } from '../utils/RolePermisionList.js';
import { globalGroupId } from './20250128045401_rel_user_group.js';

export const globalRoleId = '3c48e5b0-d386-48e0-afaa-0fb47123a55c';
export const globalRoleIdZeroTrust = '5c6c4fa6-bb54-4001-ab94-c30b5b45e57c';
export const globalUserId = '8a09ba2c-0231-4cc3-b02d-5b90054d6f90';
export const globalTesterUser = 'tester@konecta.com';
export const globalE2ETesterUser = 'usertest.e2e@konecta.com';
export const globalSystemUserId = '7d15692d-5bf4-4135-8096-06e7b1098b54';

/**
 * @param { import('knex').Knex } knex - The Knex instance.
 * @returns { Promise<void> } - A promise that resolves when the seeding is complete.
 */
export async function seed(knex) {
    const users = [
        {
            id: globalUserId,
            nombres: 'Roberto',
            apellido1: 'García',
            apellido2: 'López',
            email: 'roberto.garcia@konecta-group.com',
        },
        {
            id: uuidv4(),
            nombres: 'Andres Felipe',
            apellido1: 'Yepes',
            apellido2: 'Garces',
            email: 'andres.yepes@konecta.com',
        },
        {
            id: uuidv4(),
            nombres: 'Camilo',
            apellido1: 'Londoño',
            apellido2: 'Monsalve',
            email: 'camilo.londono@konecta.com',
        },
        {
            id: uuidv4(),
            nombres: 'Guillermo',
            apellido1: 'Mejia',
            apellido2: 'Vasquez',
            email: 'guillermo.mejia@ext.konecta.com',
        },
        {
            id: uuidv4(),
            nombres: 'Jordi',
            apellido1: 'Natividad',
            apellido2: 'Escobar',
            email: 'jnatividad@konecta.com',
        },
        {
            id: uuidv4(),
            nombres: 'Luis Manuel',
            apellido1: 'Galvan',
            apellido2: 'Coneo',
            email: 'luis.galvan@konecta.com',
        },
        {
            id: uuidv4(),
            nombres: 'David',
            apellido1: 'Castillejo',
            apellido2: 'Guisao',
            email: 'david.castillejo@konecta.com',
        },
        {
            id: uuidv4(),
            nombres: 'Daniel Steven',
            apellido1: 'Manrique',
            apellido2: 'Gonzales',
            email: 'dsmanriqueg@konecta.com',
        },
        {
            id: uuidv4(),
            nombres: 'Tester',
            apellido1: 'Automation',
            apellido2: '',
            email: globalTesterUser,
            account_type: 2,
            sub: '8448f478-7071-70a3-9959-d3d38b78d18f',
        },
        {
            id: uuidv4(),
            nombres: 'E2E',
            apellido1: 'User',
            apellido2: '',
            email: globalE2ETesterUser,
            account_type: 2,
            sub: '54e8d4f8-3091-7077-0002-0e8dfcdf6d7b',
            cognito_hash_data:
                process.env.TEST_CLIENT_FINGERPRINT || process.env.APPS_CLIENT_FINGERPRINT || '1234567890',
        },
    ];

    for (const user of users) {
        await knex('usuarios').insert({
            id: user.id,
            login: user.sub ?? user.email,
            nombres: user.nombres,
            apellido1: user.apellido1,
            apellido2: user.apellido2,
            email: user.email,
            telefono: '5512345678',
            movil: '5512345678',
            is_active: 1,
            token: null,
            session_id: null,
            rol_id: null,
            inactivo_desde: null,
            inactivo_hasta: null,
            intento_login: null,
            fecha_bloqueo: null,
            grupo_activo: null,
            codigos_externos: null,
            external_id: null,
            account_type: user.account_type ?? 1,
            cognito_hash_data: user.cognito_hash_data ?? null,
            es_externo: null,
            envio_correo: null,
            grid: null,
            created_at: new Date().toISOString(),
            updated_at: null,
            created_by: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            filters: null,
        });
    }

    await knex('roles').insert({
        id: globalRoleId,
        descripcion: 'Administrators',
        permisos: RolePermisionList(true),
        status: 1,
        configuracion: null,
        tipo_id: null,
        created_at: '2024-12-08 16:17:59.737000 +00:00',
        updated_at: '2024-12-08 16:17:59.753394 +00:00',
        created_by: globalUserId,
        updated_by: globalUserId,
        deleted_at: null,
        deleted_by: null,
        policy_id: null,
    });

    await knex('roles').insert({
        id: globalRoleIdZeroTrust,
        descripcion: 'Zero Trust',
        permisos: RolePermisionList(false),
        status: 1,
        configuracion: null,
        tipo_id: null,
        created_at: '2024-12-08 16:17:59.737000 +00:00',
        updated_at: '2024-12-08 16:17:59.753394 +00:00',
        created_by: globalUserId,
        updated_by: globalUserId,
        deleted_at: null,
        deleted_by: null,
        policy_id: null,
    });

    for (const user of users) {
        await knex('usuarios').where('id', user.id).update({
            rol_id: globalRoleId,
            created_by: globalUserId,
        });
    }

    await knex('usuarios').insert({
        id: globalSystemUserId,
        login: 'Kace Bot',
        nombres: 'Kace',
        apellido1: 'Bot',
        apellido2: '',
        email: 'kace.bot@konecta.com',
        telefono: null,
        movil: null,
        is_active: 1,
        token: null,
        session_id: null,
        rol_id: globalRoleId,
        inactivo_desde: null,
        inactivo_hasta: null,
        intento_login: null,
        fecha_bloqueo: null,
        grupo_activo: null,
        codigos_externos: null,
        external_id: null,
        account_type: 2,
        es_externo: null,
        envio_correo: null,
        grid: null,
        created_at: new Date().toISOString(),
        updated_at: null,
        created_by: globalUserId,
        updated_by: null,
        deleted_at: null,
        deleted_by: null,
        filters: null,
    });
}
