/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('actions', function (table) {
        table.string('id', 36).primary();
        table.string('action_type', 100);
        table.string('description', 255);
        table.jsonb('conditions');
        table.jsonb('triggers');
        table.jsonb('permissions');

        table.string('state_id', 36);
        table.string('group_id', 36);
        table.string('responsible_id', 36);
        table.string('template_id', 36);
        table.string('mail_account_id', 36);
        table.string('advisor_list_id', 36);
        table.string('group_list_id', 36);

        table.string('ws_rest_flow_id', 36);
        table.string('model_update_id', 36);

        table.string('external_group_code', 200);
        table.string('external_user_code', 200);
        table.integer('priority');

        table.boolean('is_active');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('actions');
}
