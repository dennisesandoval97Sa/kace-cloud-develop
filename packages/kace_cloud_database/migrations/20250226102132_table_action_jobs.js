/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('action_jobs', function (table) {
        table.string('id', 36).primary();
        table.string('type', 15);
        table.boolean('is_pending');
        table.boolean('is_in_progress');
        table.boolean('is_completed');
        table.string('action_id', 36);
        table.jsonb('search_filter');
        table.string('s3_file_key', 1024);
        table.integer('total_records');
        table.integer('processed_records');
        table.integer('failed_records');
        table.jsonb('details');
        table.boolean('notifications_sent');
        table.timestamp('start_at');
        table.timestamp('end_at');
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
    return knex.schema.dropTable('action_jobs');
}
