/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('one-script', function (table) {
        table.string('id', 36).primary();
        table.string('name', 255);
        table.text('url');
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
    return knex.schema.dropTable('one-script');
}
