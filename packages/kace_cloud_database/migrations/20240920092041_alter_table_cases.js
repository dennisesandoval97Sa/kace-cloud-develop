/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('casos', function (table) {
        table.boolean('cambio_clasificacion');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('casos', function (table) {
        table.dropColumn('cambio_clasificacion');
    });
}
