/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

export function up(knex) {
    return knex.schema.createTable('s3_import_files', function (table) {
        table.uuid('id').primary();
        table.string('file_path', 500).notNullable();
        table.string('target_table', 50).notNullable();
        table.string('status', 50).notNullable();
        table.integer('upload_attempts').defaultTo(0);
        table.integer('total_records').defaultTo(0);
        table.integer('processed_records').defaultTo(0);
        table.timestamp('last_updated_at').defaultTo(knex.fn.now());
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.uuid('created_by').notNullable();
        table.text('error_details');

        table.index('status');
        table.index('created_by');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('s3_import_files');
}
