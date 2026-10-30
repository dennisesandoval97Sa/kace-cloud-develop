/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

export function up(knex) {
    return knex.schema.createTable('helps', function (table) {
        table.string('id', 36).primary();
        table.text('descripcion');
        table.string('titulo', 50);
        table.string('color', 20);
        table.boolean('is_active');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('created_by', 36);
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('updated_by', 36);
        table.timestamp('deleted_at').defaultTo(knex.fn.now());
        table.string('deleted_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('helps');
}
