/**
 * Counter table backing the `sequence` segment of a folio configuration.
 *
 * One row per (configuration, reset scope). `scope_key` is '' when the counter never
 * resets, otherwise the rendered year/month/day or the rendered folio prefix — see
 * ScopeKeyResolver.
 *
 * The next value is taken with a single self-referencing statement
 * (`UPDATE ... SET current_value = current_value + 1 ... RETURNING`), which under READ
 * COMMITTED holds a row lock until COMMIT and re-evaluates the expression against the
 * committed row afterwards. That is what makes two concurrent case creations impossible
 * to serve with the same number.
 *
 * `current_value` is int4 on purpose: it covers 9 digits with room to spare, and `pg`
 * returns bigint as a string, which would silently break the padding.
 *
 * The composite PK is the only constraint (Guía A §6.4): KnexFolioSequenceRepository writes
 * every column, `scope_key` '' included.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('folio_sequences', function (table) {
        table.string('config_id', 36);
        table.string('scope_key', 120);
        table.integer('current_value');
        table.integer('start_value');
        table.timestamp('created_at');
        table.timestamp('updated_at');

        // Both the lookup index and the ON CONFLICT target of the idempotent seed.
        table.primary(['config_id', 'scope_key']);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('folio_sequences');
}
