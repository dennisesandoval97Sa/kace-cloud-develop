/**
 * Last line of defence against duplicated folios. The counter in `folio_sequences`
 * already serialises concurrent reservations, but if any code path ever bypasses it the
 * database must reject the duplicate instead of storing it.
 *
 * The predicate deliberately omits `deleted_at IS NULL`: a folio is a legal identifier,
 * so a soft-deleted case must keep occupying its number.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // Disable session statement_timeout so a long CONCURRENTLY build is not aborted on
    // environments that set a default timeout — an aborted build leaves the index INVALID.
    await knex.raw('SET statement_timeout = 0');
    // If a previous run was interrupted the index may exist as INVALID; IF NOT EXISTS would
    // short-circuit and we'd silently keep the unused INVALID index, so drop it first.
    // Scoped to current_schema(): index names repeat across tenant schemas, and an unscoped
    // probe would drop the valid index of the tenant being migrated, or fail on one that
    // does not have it yet. The unqualified DROP resolves to that same schema via search_path.
    const invalid = await knex.raw(
        `SELECT 1
         FROM pg_index i
         JOIN pg_class c ON c.oid = i.indexrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relname = ? AND n.nspname = current_schema() AND NOT i.indisvalid`,
        ['idx_cases_folio_unique']
    );
    if (invalid.rows.length > 0) {
        await knex.raw('DROP INDEX CONCURRENTLY idx_cases_folio_unique');
    }
    await knex.raw(`
        CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_folio_unique
        ON cases (folio)
        WHERE folio IS NOT NULL
    `);
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_cases_folio_unique');
}

// CONCURRENTLY requires running outside a transaction; both up and down inherit this.
export const config = { transaction: false };
