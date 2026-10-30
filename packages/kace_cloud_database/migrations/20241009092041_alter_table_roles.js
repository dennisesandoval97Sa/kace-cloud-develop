/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('roles', function (table) {
        table.string('policy_id', 36);
        table.foreign('policy_id').references('id').inTable('policies');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('roles', function (table) {
        table.dropForeign('policy_id');
        table.dropColumn('policy_id');
    });
}
