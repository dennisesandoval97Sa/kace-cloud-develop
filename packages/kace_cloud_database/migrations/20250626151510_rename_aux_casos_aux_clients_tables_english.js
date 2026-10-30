/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.renameTable('aux_casos', 'aux_cases');
    await knex.schema.renameTable('aux_clientes', 'aux_clients');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.renameTable('aux_cases', 'aux_casos');
    await knex.schema.renameTable('aux_clients', 'aux_clientes');
}
