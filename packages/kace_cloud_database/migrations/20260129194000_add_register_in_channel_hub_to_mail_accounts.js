export async function up(knex) {
    await knex.schema.alterTable('mail_accounts', function (table) {
        table.boolean('register_in_channel_hub');
    });
}

export async function down(knex) {
    await knex.schema.alterTable('mail_accounts', function (table) {
        table.dropColumn('register_in_channel_hub');
    });
}
