/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.alterTable('emails_body', (table) => {
        table.string('body_text_storage_mode', 16).nullable();
        table.string('body_text_s3_key', 1024).nullable();
        table.bigInteger('body_text_size_bytes').nullable();
        table.string('body_text_content_type', 255).nullable();
        table.string('body_text_sha256', 64).nullable();
        table.boolean('body_text_preview_truncated').notNullable().defaultTo(false);

        table.string('body_html_storage_mode', 16).nullable();
        table.string('body_html_s3_key', 1024).nullable();
        table.bigInteger('body_html_size_bytes').nullable();
        table.string('body_html_content_type', 255).nullable();
        table.string('body_html_sha256', 64).nullable();
        table.boolean('body_html_preview_truncated').notNullable().defaultTo(false);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.alterTable('emails_body', (table) => {
        table.dropColumn('body_text_storage_mode');
        table.dropColumn('body_text_s3_key');
        table.dropColumn('body_text_size_bytes');
        table.dropColumn('body_text_content_type');
        table.dropColumn('body_text_sha256');
        table.dropColumn('body_text_preview_truncated');

        table.dropColumn('body_html_storage_mode');
        table.dropColumn('body_html_s3_key');
        table.dropColumn('body_html_size_bytes');
        table.dropColumn('body_html_content_type');
        table.dropColumn('body_html_sha256');
        table.dropColumn('body_html_preview_truncated');
    });
}
