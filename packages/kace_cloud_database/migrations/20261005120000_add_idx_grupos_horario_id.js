/**
 * Index for the "schedule in use" count that runs inside the schedule delete transaction,
 * while that transaction holds the schedule row lock.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('grupos', (table) => {
        table.index('horario_id', 'idx_grupos_horario_id');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('grupos', (table) => {
        table.dropIndex('horario_id', 'idx_grupos_horario_id');
    });
}
