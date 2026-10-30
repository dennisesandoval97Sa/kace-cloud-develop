/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('mail_accounts', function (table) {
        table.jsonb('channel_hub_error');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('mail_accounts', function (table) {
        table.dropColumn('channel_hub_error');
    });
}
