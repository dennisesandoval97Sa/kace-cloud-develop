/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('workspaces_channel_hub_accounts_relations', (table) => {
        table.string('workspace_id', 36).notNullable();
        table.string('channel_hub_account_id', 36).notNullable();

        table.primary(['workspace_id', 'channel_hub_account_id']);
        table.foreign('workspace_id').references('id').inTable('workspaces');
        table.foreign('channel_hub_account_id').references('id').inTable('channel_hub_accounts');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('workspaces_channel_hub_accounts_relations');
}
