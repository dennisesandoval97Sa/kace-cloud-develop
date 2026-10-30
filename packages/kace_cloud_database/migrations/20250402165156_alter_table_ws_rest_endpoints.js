export async function up(knex) {
    await knex.schema.table('ws_rest_endpoints', (table) => {
        table.boolean('is_dynamic_header');
        table.dropColumn('token_location');
        table.dropColumn('authorization_type');
        table.jsonb('filter_input');
        table.string('context_position', 30);
        table.jsonb('on_success');
        table.jsonb('on_error');
        table.integer('attempts');
    });
}

export async function down(knex) {
    await knex.schema.table('ws_rest_endpoints', (table) => {
        table.dropColumn('is_dynamic_header');
        table.string('token_location');
        table.string('authorization_type', 36).nullable();
        table.dropColumn('filter_input');
        table.dropColumn('context_position');
        table.dropColumn('on_success');
        table.dropColumn('on_error');
        table.dropColumn('attempts');
    });
}
