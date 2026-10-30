/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('emails', function (table) {
        table.string('id', 36).primary();
        table.string('s3_key', 255);
        table.string('subject', 120);
        table.string('sender', 120);
        table.jsonb('to');
        table.jsonb('cc');
        table.jsonb('bcc');
        table.string('priority', 80);
        table.string('workspace_id', 36);
        table.string('message_id', 36);
        table.string('account_id', 36);
        table.timestamp('received_at');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);

        table.foreign('workspace_id').references('id').inTable('workspaces');
        table.foreign('account_id').references('id').inTable('mail_accounts');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('emails');
}
