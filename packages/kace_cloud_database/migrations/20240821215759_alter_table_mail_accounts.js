/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('mail_accounts', (table) => {
        table.renameColumn('status', 'is_active');
        table.jsonb('vault_data').alter();
        table.jsonb('folders').alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('mail_accounts', (table) => {
        table.json('vault_data').alter();
        table.json('folders').alter();
    });
}
