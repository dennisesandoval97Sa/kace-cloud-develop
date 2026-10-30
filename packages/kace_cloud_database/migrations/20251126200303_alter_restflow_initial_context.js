/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    await knex.schema.table('ws_rest_flows', (table) => {
        table.jsonb('initial_context').nullable();
    });

}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    await knex.schema.table('ws_rest_flows', (table) => {
        table.dropColumn('initial_context');
    });

}
