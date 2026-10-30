/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('ws_rest_endpoints', (table) => {
        table.string('context_position', 255).alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('ws_rest_endpoints', (table) => {
        table.string('context_position', 30).alter();
    });
}
