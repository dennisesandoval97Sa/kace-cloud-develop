/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('csv_export_views', function (table) {
        table.string('id', 36).primary();
        table.string('description', 255);
        table.boolean('is_active');

        table.jsonb('views');
        table.string('frequency', 10);
        table.integer('interval');
        table.jsonb('time_filter');

        table.string('storage_path', 1024);

        table.timestamp('last_execution_at');
        table.jsonb('last_execution_details');
        table.timestamp('next_execution_at');

        table.string('created_by', 36);
        table.timestamp('created_at');
        table.string('updated_by', 36);
        table.timestamp('updated_at');
        table.string('deleted_by', 36);
        table.timestamp('deleted_at');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('csv_export_views');
}
