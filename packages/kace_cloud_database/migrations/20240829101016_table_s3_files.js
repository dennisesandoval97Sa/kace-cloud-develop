/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export function up(knex) {
    return knex.schema.createTable('s3_files', function (table) {
        table.string('id', 36).primary();
        table.string('description', 255);
        table.string('file_name', 100);
        table.string('s3_file_name', 100);
        table.string('url', 1000);
        table.bigint('size');
        table.string('origin', 100);
        table.timestamp('expired_at');
        table.boolean('is_active');
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export function down(knex) {
    return knex.schema.dropTable('s3_files');
}
