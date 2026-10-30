/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('casos', function (table) {
        table.string('cloned_by', 36);
        table.timestamp('cloned_at');
        table.string('reopen_by', 36);
        table.timestamp('reopen_at');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('casos', function (table) {
        table.dropColumn('cloned_by');
        table.dropColumn('cloned_at');
        table.dropColumn('reopen_by');
        table.dropColumn('reopen_at');
    });
}
