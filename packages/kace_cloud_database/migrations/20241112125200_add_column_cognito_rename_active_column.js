/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('usuarios', (table) => {
        table.renameColumn('status', 'is_active');
        table.text('cognito_hash_data').nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('usuarios', (table) => {
        table.renameColumn('is_active', 'status');
        table.dropColumn('cognito_hash_data');
    });
}
