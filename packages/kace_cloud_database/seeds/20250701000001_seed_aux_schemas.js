import { globalUserId } from './20241125105900_usuario_base.js';

export const schemaAuxCasesId = 'c36f7f91-1fc1-4a5e-b20a-3fc1c3b6bcd7';
export const schemaAuxClientsId = 'c36f7f91-1fc1-4a5e-b20a-3fc1c3b6bcd8';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    const now = new Date().toISOString();

    await knex('schemas').insert([
        {
            id: schemaAuxCasesId,
            name: 'aux_cases',
            is_active: true,
            data_structure: { field: { type: 'string', required: false } },
            created_at: now,
            updated_at: now,
            deleted_at: null,
            created_by: globalUserId,
            updated_by: globalUserId,
            deleted_by: null,
        },
        {
            id: schemaAuxClientsId,
            name: 'aux_clients',
            is_active: true,
            data_structure: { field: { type: 'string', required: false } },
            created_at: now,
            updated_at: now,
            deleted_at: null,
            created_by: globalUserId,
            updated_by: globalUserId,
            deleted_by: null,
        },
    ]);
}
