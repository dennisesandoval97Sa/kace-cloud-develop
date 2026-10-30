/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('horarios_dias', function (table) {
        table.string('id', 36).primary();
        table.string('dia_semana', 100);
        table.boolean('es_laboral');
        table.time('hora_inicio_jornada');
        table.time('hora_fin_jornada');
        table.string('horario_id', 36);
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
    return knex.schema.dropTable('horarios_dias');
}
