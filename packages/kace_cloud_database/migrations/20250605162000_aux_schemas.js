/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .createTable('schemas', function (table) {
            table.string('id', 36).primary();
            table.string('name', 45);
            table.boolean('is_active');
            table.jsonb('data_structure');
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.timestamp('deleted_at');
            table.string('created_by', 36);
            table.string('updated_by', 36);
            table.string('deleted_by', 36);
        })
        .createTable('history_schemas', function (table) {
            table.string('id', 36).primary();
            table.string('entity_id', 36);
            table.jsonb('changed_attributes');
            table.jsonb('new_attributes');
            table.jsonb('original_attributes');
            table.timestamp('created_at');
            table.string('created_by', 36);

            table.foreign('entity_id').references('id').inTable('schemas');
        });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('history_schemas').dropTableIfExists('schemas');
}
