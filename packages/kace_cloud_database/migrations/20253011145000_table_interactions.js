/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('interactions', function (table) {
        table.string('id', 36).primary();
        table.string('channel_id', 36).notNullable();
        table.string('client_id', 36).notNullable();
        table.string('external_id', 36);
        table.text('description');
        table.string('priority', 50);
        table.string('status', 50).notNullable();
        table.string('mailbox_id', 36);
        table.string('conversation_id', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('interactions');
}