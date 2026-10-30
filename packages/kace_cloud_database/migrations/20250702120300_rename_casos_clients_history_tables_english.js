/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.renameTable('history_casos', 'history_cases');
    await knex.schema.renameTable('history_clientes', 'history_clients');
    await knex.schema.renameTable('history_aux_casos', 'history_aux_cases');
    await knex.schema.renameTable('history_aux_clientes', 'history_aux_clients');
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.renameTable('history_cases', 'history_casos');
    await knex.schema.renameTable('history_clients', 'history_clientes');
    await knex.schema.renameTable('history_aux_cases', 'history_aux_casos');
    await knex.schema.renameTable('history_aux_clients', 'history_aux_clientes');
}
