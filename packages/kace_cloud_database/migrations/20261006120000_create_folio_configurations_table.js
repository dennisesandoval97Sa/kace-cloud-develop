/**
 * Neutral columns (Guía A §6.4): required fields and defaults live in the FolioConfiguration
 * aggregate, which validates them before the repository writes the row.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('folio_configurations', function (table) {
        table.string('id', 36).primary();
        table.string('nombre', 255);
        table.string('descripcion', 500).nullable();
        // Ordered list of segments. Each item is { type, ...params } — see FolioRenderer.
        table.jsonb('segments');
        // never | yearly | monthly | daily | prefix
        table.string('reset_policy', 20);
        table.integer('start_value');
        // fail | grow. Never truncate: truncating a folio produces silent duplicates.
        table.string('overflow_policy', 10);
        table.smallint('status');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.string('created_by', 36).nullable();
        table.string('updated_by', 36).nullable();
        table.timestamp('deleted_at').nullable();
        table.string('deleted_by', 36).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('folio_configurations');
}
