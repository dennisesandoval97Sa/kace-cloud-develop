/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('grupos', function (table) {
        table.string('id', 36).primary();
        table.string('nombre', 100);
        table.smallint('status');
        table.string('horario_id', 36).unsigned();
        table.string('descripcion', 100);
        table.string('codigo_externo', 45);
        table.jsonb('permisos');
        table.jsonb('layouts');
        table.jsonb('comportamientos');
        table.text('filter_order', 20);
        table.jsonb('codigos_externos');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();

        table.foreign('horario_id').references('id').inTable('horarios');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('grupos');
}
