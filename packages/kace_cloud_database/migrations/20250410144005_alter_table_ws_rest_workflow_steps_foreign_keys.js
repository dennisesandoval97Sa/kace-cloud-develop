/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('ws_rest_workflow_steps', (table) => {
        table.foreign('flow_id').references('id').inTable('ws_rest_flows');
        table.foreign('endpoint_id').references('id').inTable('ws_rest_endpoints');
        table.foreign('function_id').references('id').inTable('ws_rest_functions');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('ws_rest_workflow_steps', (table) => {
        table.dropForeign('flow_id');
        table.dropForeign('endpoint_id');
        table.dropForeign('function_id');
    });
}
