/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('ws_rest_workflow_steps', function (table) {
        table.string('id', 36).primary();
        table.string('flow_id', 36);
        table.integer('order');
        table.string('endpoint_id', 36).nullable();
        table.string('function_id', 36).nullable();
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);

        table.index('flow_id');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('ws_rest_workflow_steps');
}
