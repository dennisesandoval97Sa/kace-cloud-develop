/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('ws_rest_functions', (table) => {
        table.string('id', 36).primary();
        table.string('description', 255);
        table.string('type', 255);
        table.jsonb('filter_input');
        table.text('context_position');
        table.boolean('value_dynamic');
        table.text('value_static');
        table.boolean('is_active');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('ws_rest_functions');
}
