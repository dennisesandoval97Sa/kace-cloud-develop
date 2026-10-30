/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('horarios_dias_festivos', function (table) {
        table.string('id', 36).primary();
        table.string('horario_id', 36);
        table.date('fecha');
        table.smallint('status');
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
    return knex.schema.dropTable('horarios_dias_festivos');
}
