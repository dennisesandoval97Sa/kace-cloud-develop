/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.alterTable('workspaces', (table) => {
        table.jsonb('rules')
        table.jsonb('mails_accounts')


    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.alterTable('workspaces', (table) => {
        table.dropColumn('rules');
        table.dropColumn('mails_accounts');
    });
}
