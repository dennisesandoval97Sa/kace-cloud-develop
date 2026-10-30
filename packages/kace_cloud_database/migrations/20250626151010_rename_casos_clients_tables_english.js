/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.renameTable('casos', 'cases');
    await knex.schema.renameTable('clientes', 'clients');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.renameTable('cases', 'casos');
    await knex.schema.renameTable('clients', 'clientes');
}
