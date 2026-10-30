/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('background_executions', (table) => {
        table.string('id', 36).primary();
        table.string('proccess_description', 255);
        table.boolean('execution_status');
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
    return knex.schema.dropTable('background_executions');
}
