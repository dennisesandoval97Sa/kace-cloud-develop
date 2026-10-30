/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('boveda_secretos', (table) => {
        table.string('id', 36).primary();
        table.string('descripcion', 255);
        table.string('referencia', 255).unique().notNullable();
        table.text('secreto');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.timestamp('deleted_at');
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('boveda_secretos');
}
