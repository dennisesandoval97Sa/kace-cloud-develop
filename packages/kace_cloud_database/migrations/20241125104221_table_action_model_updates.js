/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('action_model_updates', function (table) {
        table.string('id', 36).primary();
        table.string('description', 255).notNullable();
        table.string('aggregate', 50).notNullable();
        table.string('field', 100);
        table.string('type', 50);
        table.string('value', 100);
        table.string('formula', 100);

        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('action_model_updates');
}
