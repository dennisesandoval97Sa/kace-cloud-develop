import { globalUserId } from '../seeds/20241125105900_usuario_base.js';

const tableName = 'background_executions';
/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable(tableName, (table) => {
        table.timestamp('created_at');
        table.string('created_by', 36);
    });

    const process = [
        { id: '519a9ca7-1231-4939-bfa6-de8826cb5fb2', proccess_description: 'action_queue_execution' },
        { id: '4f7def75-bc8a-482f-8ae6-acecc1ef3936', proccess_description: 'action_queue_executor' },
    ];

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

    console.warn(
        '⚠️ Advertencia: Esta migración "20250729112800_insert_background_process_services" no debería revertirse. No se realizará ninguna acción.'
    );
}
