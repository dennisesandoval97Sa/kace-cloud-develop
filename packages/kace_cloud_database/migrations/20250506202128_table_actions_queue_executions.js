/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('actions_queue_executions', (table) => {
        table.string('id', 36).primary();
        table.string('action_id', 36);
        table.string('case_id', 36).nullable();
        table.string('client_id', 36).nullable();
        table.string('status', 255);
        table.string('trigger_type', 255);
        table.timestamp('start_execution').nullable();
        table.timestamp('end_execution').nullable();

        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');

        table.foreign('action_id').references('id').inTable('actions');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('actions_queue_executions');
}
