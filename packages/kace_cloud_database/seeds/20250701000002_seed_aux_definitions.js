import { v4 as uuidv4 } from 'uuid';
import { globalUserId } from './20241125105900_usuario_base.js';

export const schemaAuxCasesId = 'c36f7f91-1fc1-4a5e-b20a-3fc1c3b6bcd7';
export const schemaAuxClientsId = 'c36f7f91-1fc1-4a5e-b20a-3fc1c3b6bcd8';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    const now = new Date().toISOString();

    await knex('aux_definitions').insert([
        {
            id: uuidv4(),
            name: 'cases',
            tablename: 'aux_cases',
            logs_tablename: 'history_aux_cases',
            schema_id: schemaAuxCasesId,
            restflow_id: null,
            is_active: true,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            created_by: globalUserId,
            updated_by: globalUserId,
            deleted_by: null,
        },
        {
            id: uuidv4(),
            name: 'clients',
            tablename: 'aux_clients',
            logs_tablename: 'history_aux_clients',
            schema_id: schemaAuxClientsId,
            restflow_id: null,
            is_active: true,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            created_by: globalUserId,
            updated_by: globalUserId,
            deleted_by: null,
        },
    ]);
}
