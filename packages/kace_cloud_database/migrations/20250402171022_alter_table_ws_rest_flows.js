/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('ws_rest_flows', (table) => {
        table.dropForeign('consumption_id');
    });

    await knex.schema.alterTable('ws_rest_flows', (table) => {
        table.dropColumns('consumption_id', 'timeout');

        table.string('external_code', 255).after('description');
        table.jsonb('json_diagram_properties').after('external_code');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('ws_rest_flows', (table) => {
        table.string('consumption_id', 36).after('description');
        table.integer('timeout').after('consumption_id');

        table.dropColumns('external_code', 'json_diagram_properties');

        table.foreign('consumption_id').references('id').inTable('ws_rest_endpoints');
    });
}
