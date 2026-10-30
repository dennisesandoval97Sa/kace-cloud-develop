/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('flujos', function (table) {
        table.string('id', 36).primary();
        table.string('nombre', 100);
        table.text('json_flujo');
        table.integer('status');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('flujos');
}
