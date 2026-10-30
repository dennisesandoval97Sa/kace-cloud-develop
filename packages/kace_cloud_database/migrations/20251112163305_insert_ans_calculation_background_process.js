import { globalUserId } from '../seeds/20241125105900_usuario_base.js';

const tableName = 'background_executions';
/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const process = [{ id: '84c17444-0aec-4c1b-b76e-1df25287c2dd', proccess_description: 'ans_calculation' }];

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
