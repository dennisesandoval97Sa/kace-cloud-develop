/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('case_attachments', function (table) {
        table.string('id', 36).primary();
        table.string('case_id', 36).notNullable();
        table.string('description', 255);
        table.bigInteger('size');
        table.string('path', 1000);
        table.smallint('type');
        table.boolean('is_active');
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
    return knex.schema.dropTable('case_attachments');
}
