import { globalUserId, globalRoleId, globalRoleIdZeroTrust } from './20241125105900_usuario_base.js';
import { globalConfigurationId, globalConfigurationIdZeroTrust } from './20241125105901_configuration.js';

export const globalGroupId = '3824c61a-6368-4c5c-957f-769525109e85';

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    const work_days = {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
    };

    await knex('shift_management').insert({
        id: globalGroupId,
        work_days: JSON.stringify(work_days),
        holiday_dates: JSON.stringify(['2024-09-03', '2024-12-29']),

        description: 'Horario inicial',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
        created_by: globalUserId,
        updated_by: globalUserId,
    });

    await knex('grupos').insert({
        id: globalGroupId,
        nombre: 'Administrators Group',
        status: 1,
        horario_id: globalGroupId,
        descripcion: 'Administrators Group',
        codigo_externo: null,
        codigos_externos: null,
        permisos: {},
        layouts: {},
        comportamientos: {},
        filter_order: 'filter orden incial',
        rol_id: globalRoleId,
        configuration_id: globalConfigurationId,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
        created_by: globalUserId,
        updated_by: globalUserId,
    });

    const users = await knex('usuarios').select('id');

    for (const user of users) {
        await knex('rel_usuarios_grupos').insert({
            grupo_id: globalGroupId,
            usuario_id: user.id,
        });
    }

    await knex('grupos').insert({
        id: globalConfigurationIdZeroTrust,
        nombre: 'New users',
        status: 1,
        horario_id: globalGroupId,
        descripcion: 'New users',
        codigo_externo: null,
        codigos_externos: null,
        permisos: {},
        layouts: {},
        comportamientos: {},
        filter_order: 'filter orden incial',
        rol_id: globalRoleIdZeroTrust,
        configuration_id: globalConfigurationIdZeroTrust,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
        created_by: globalUserId,
        updated_by: globalUserId,
    });
}
