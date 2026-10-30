/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('workspaces_mail_accounts_relations', (table) => {
        table.string('workspace_id', 36).notNullable();
        table.string('mail_account_id', 36).notNullable();

        table.primary(['workspace_id', 'mail_account_id']);
        table.foreign('workspace_id').references('id').inTable('workspaces');
        table.foreign('mail_account_id').references('id').inTable('mail_accounts');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('workspaces_mail_accounts_relations');
}
