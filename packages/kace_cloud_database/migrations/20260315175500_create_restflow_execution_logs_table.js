/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('restflow_execution_logs', function (table) {
        table.string('id', 36).primary();
        table.string('restflow_id', 36).notNullable();
        table.string('case_id', 36).nullable();
        table.string('client_id', 36).nullable();
        table.jsonb('context').nullable();
        table.timestamp('executed_at').defaultTo(knex.fn.now());
        table.string('executed_by', 36).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('restflow_execution_logs');
}
