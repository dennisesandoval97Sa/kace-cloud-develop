/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('ws_rest_endpoints', (table) => {
        table.string('body_type', 20).notNullable().defaultTo('json');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('ws_rest_endpoints', (table) => {
        table.dropColumn('body_type');
    });
}
