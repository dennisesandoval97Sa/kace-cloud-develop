/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('case_attachments', function (table) {
        table.string('attachment_type', 255).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('case_attachments', function (table) {
        table.dropColumn('attachment_type');
    });
}
