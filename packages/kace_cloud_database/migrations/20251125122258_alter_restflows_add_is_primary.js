/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    await knex.schema.table('ws_rest_flows', (table) => {
        table.boolean('is_primary').notNullable().defaultTo(true);
    });

}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    await knex.schema.table('ws_rest_flows', (table) => {
        table.dropColumn('is_primary');
    });

}
