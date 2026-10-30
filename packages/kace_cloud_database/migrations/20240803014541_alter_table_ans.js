/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('ans', function (table) {
        table.timestamp('created_at').defaultTo(null).alter();
        table.timestamp('updated_at').defaultTo(null).alter();
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
        table.dropForeign('medicion_ans_id');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('ans', function (table) {
        table.timestamp('created_at').defaultTo(knex.fn.now()).alter();
        table.timestamp('updated_at').defaultTo(knex.fn.now()).alter();
        table.dropColumn('deleted_at');
        table.dropColumn('deleted_by');
    });
}
