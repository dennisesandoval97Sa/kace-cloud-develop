/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('template_attachments', function (table) {
        // Backfilled to 'attachment' for existing rows (ADD COLUMN ... DEFAULT applies to
        // pre-existing rows on both Postgres and SQLite) so `usage_type != 'inline'` queries
        // never have to special-case NULL — under standard SQL, `NULL != 'inline'` is not
        // true, so any row left NULL here would silently disappear from that filter.
        table.string('usage_type', 20).notNullable().defaultTo('attachment');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('template_attachments', function (table) {
        table.dropColumn('usage_type');
    });
}
