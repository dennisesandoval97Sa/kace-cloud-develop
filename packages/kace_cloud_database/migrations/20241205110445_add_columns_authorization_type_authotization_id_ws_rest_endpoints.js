export async function up(knex) {
    await knex.schema.table('ws_rest_endpoints', (table) => {
        table.string('authorization_type', 36).nullable();

        table.string('authorization_id', 36).nullable();
        table.foreign('authorization_id').references('id').inTable('ws_rest_endpoints');
    });
}

export async function down(knex) {
    await knex.schema.table('ws_rest_endpoints', (table) => {
        table.dropColumn('authorization_type');
        table.dropColumn('authorization_id');
    });
}
