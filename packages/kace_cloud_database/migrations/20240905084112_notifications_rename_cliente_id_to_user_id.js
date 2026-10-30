/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('user_notifications', function (table) {
        table.renameColumn('cliente_id', 'user_id');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('user_notifications', function (table) {
        table.renameColumn('user_id', 'cliente_id');
    });
}
