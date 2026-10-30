/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('channel_hub_accounts', function (table) {
        table.string('id', 36).primary();
        table.string('email', 255).notNullable();
        table.string('name', 255).notNullable();
        table.string('country_id', 10).notNullable();
        table.string('rest_flow_id', 36).notNullable();
        table.string('channel_hub_connection_id', 255).nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at').notNullable();
        table.string('created_by', 36).notNullable();
        table.timestamp('updated_at').notNullable();
        table.string('updated_by', 36).notNullable();
        table.timestamp('deleted_at').nullable();
        table.string('deleted_by', 36).nullable();
        table.jsonb('channel_hub_error').nullable();

        table.foreign('rest_flow_id').references('id').inTable('ws_rest_flows');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('channel_hub_accounts');
}
