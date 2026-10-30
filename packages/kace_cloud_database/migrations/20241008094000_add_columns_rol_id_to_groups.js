/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('grupos', (table) => {
        table.string('rol_id', 36);
        table.foreign('rol_id').references('id').inTable('roles');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('grupos', (table) => {
        table.dropForeign('rol_id');
        table.dropColumn('rol_id');
    });
}
