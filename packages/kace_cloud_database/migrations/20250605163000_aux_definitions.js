/**
 * @param { import("knex").knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .createTable('aux_definitions', function (table) {
            table.string('id', 36).primary();
            table.string('name', 45);
            table.string('tablename', 45);
            table.string('logs_tablename', 45);
            table.string('schema_id', 36);
            table.string('restflow_id', 36);
            table.boolean('is_active');
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.timestamp('deleted_at');
            table.string('created_by', 36);
            table.string('updated_by', 36);
            table.string('deleted_by', 36);

            table.foreign('schema_id').references('id').inTable('schemas');
            table.foreign('restflow_id').references('id').inTable('ws_rest_flows');
        })
        .createTable('history_aux_definitions', function (table) {
            table.string('id', 36).primary();
            table.string('entity_id', 36);
            table.jsonb('changed_attributes');
            table.jsonb('new_attributes');
            table.jsonb('original_attributes');
            table.timestamp('created_at');
            table.string('created_by', 36);

            table.foreign('entity_id').references('id').inTable('aux_definitions');
        });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('history_aux_definitions').dropTableIfExists('aux_definitions');
}
