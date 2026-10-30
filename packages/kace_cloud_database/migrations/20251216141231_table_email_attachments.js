/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('emails_attachments', function (table) {
        table.string('id', 36).primary();
        table.string('email_id', 36);
        table.string('url', 255);
        table.integer('size');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);

        table.foreign('email_id').references('id').inTable('emails');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('emails_attachments');
}
