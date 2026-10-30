export async function up(knex) {
    await knex.schema.alterTable('ws_rest_flows', (table) => {
        table.specificType('consumption_id', 'varchar(36)').alter();
        table.foreign('consumption_id').references('id').inTable('ws_rest_endpoints');
    });
}

export async function down(knex) {
    await knex.schema.alterTable('ws_rest_flows', (table) => {
        table.dropForeign('consumption_id');
    });

    await knex.schema.alterTable('ws_rest_flows', (table) => {
        table.specificType('consumption_id', 'text[]').alter();
    });
}
