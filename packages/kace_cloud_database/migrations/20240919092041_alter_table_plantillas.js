/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('plantillas', function (table) {
        table.timestamp('created_at').defaultTo(null).alter();
        table.timestamp('updated_at').defaultTo(null).alter();
        table.string('deleted_by', 36);
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('plantillas', function (table) {
        table.timestamp('created_at').defaultTo(knex.fn.now()).alter();
        table.timestamp('updated_at').defaultTo(knex.fn.now()).alter();
        table.dropColumn('deleted_by');
    });
}
