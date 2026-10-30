/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('channel_hub_accounts', function (table) {
        table.string('operator_id', 50).notNullable().defaultTo('imap');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('channel_hub_accounts', function (table) {
        table.dropColumn('operator_id');
    });
}
