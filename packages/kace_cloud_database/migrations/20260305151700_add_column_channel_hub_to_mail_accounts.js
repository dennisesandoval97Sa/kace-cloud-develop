/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('mail_accounts', function (table) {
        table.string('channel_hub_connection_id', 100);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('mail_accounts', function (table) {
        table.dropColumn('channel_hub_connection_id');
    });
}
