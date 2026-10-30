/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('banners', function (table) {
        table.string('id', 36).primary();
        table.text('descripcion');
        table.jsonb('propiedades');
        table.date('fecha_inicio');
        table.date('fecha_fin');
        table.jsonb('especificaciones');
        table.smallint('status');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();
        table.timestamp('deleted_at');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('banners');
}
