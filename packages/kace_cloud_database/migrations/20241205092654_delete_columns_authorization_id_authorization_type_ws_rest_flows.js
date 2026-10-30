export async function up(knex) {
    await knex.schema.table('ws_rest_flows', (table) => {
        table.dropColumn('authorization_id');
        table.dropColumn('authorization_type');
    });
}

export async function down(knex) {
    await knex.schema.table('ws_rest_flows', (table) => {
        table.string('authorization_id', 36);
        table.foreign('authorization_id').references('id').inTable('ws_rest_endpoints');
        table.string('authorization_type', 36);
        table.foreign('authorization_type').references('id').inTable('ws_rest_endpoints');
    });
}
