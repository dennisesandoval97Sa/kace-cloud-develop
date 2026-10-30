/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .createTable('ws_rest_endpoints', (table) => {
            table.string('id', 36).primary();
            table.string('type', 13);
            table.string('description', 255);
            table.string('url', 1000);
            table.string('method', 8);
            table.json('headers');
            table.json('body');
            table.string('token_location');
            table.boolean('is_dynamic_body');
            table.boolean('is_active');
            table.timestamp('created_at');
            table.string('created_by', 36);
            table.timestamp('updated_at');
            table.string('updated_by', 36);
            table.timestamp('deleted_at');
            table.string('deleted_by', 36);
        })
        .createTable('ws_rest_flows', (table) => {
            table.string('id', 36).primary();
            table.string('description', 255);
            table.string('authorization_id', 36);
            table.string('consumption_id', 36);
            table.string('authorization_type', 50);
            table.integer('timeout');
            table.boolean('is_active');
            table.timestamp('created_at');
            table.string('created_by', 36);
            table.timestamp('updated_at');
            table.string('updated_by', 36);
            table.timestamp('deleted_at');
            table.string('deleted_by', 36);

            table.foreign('authorization_id').references('id').inTable('ws_rest_endpoints');
            table.foreign('consumption_id').references('id').inTable('ws_rest_endpoints');
        });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('ws_rest_flows').dropTableIfExists('ws_rest_endpoints');
}
