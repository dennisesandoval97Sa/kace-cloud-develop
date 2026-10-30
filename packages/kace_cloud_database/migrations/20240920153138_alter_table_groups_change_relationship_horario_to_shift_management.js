/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('grupos', function (table) {
        table.dropForeign('horario_id');
        table.foreign('horario_id').references('id').inTable('shift_management');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('grupos', function (table) {
        table.dropForeign('horario_id');
    });
}
