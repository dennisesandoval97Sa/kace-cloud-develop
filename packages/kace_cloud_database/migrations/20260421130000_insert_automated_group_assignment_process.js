import { globalUserId } from '../seeds/20241125105900_usuario_base.js';

const tableName = 'background_executions';
/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const process = [{ id: 'ccb1cce2-f6a4-4003-a67f-f314abd7f096', proccess_description: 'automated_group_assignment' }];

    const currentDate = new Date().toISOString();
    for (const p of process) {
        p.created_at = currentDate;
        p.created_by = globalUserId;
    }

    await knex(tableName).insert(process);
}

export async function down() {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    console.warn('⚠️ Advertencia: Esta migración no debería revertirse. No se realizará ninguna acción.');
}
