/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('ws_rest_flow_executions', function (table) {
        table.string('id', 36).primary();
        table.string('flow_id', 36);
        table.string('external_code', 255);
        table.jsonb('initial_context');
        table.string('status', 20).notNullable().defaultTo('pending');
        table.jsonb('result');
        table.jsonb('error');
        table.string('created_by', 36);
        table.timestamp('created_at');
        table.timestamp('started_at');
        table.timestamp('completed_at');
        table.string('updated_by', 36);
        table.timestamp('updated_at');
        table.string('deleted_by', 36);
        table.timestamp('deleted_at');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('ws_rest_flow_executions');
}
