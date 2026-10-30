/**
 * Adds a partial btree index on cases(parent_id) to support parent→child lookups.
 *
 * The reports_cierre_de_proveedores_* views join children to their parent via
 * `JOIN cases ce ON ce.parent_id = c.id`. Without an index on parent_id the planner
 * falls back to a Seq Scan on cases inside a nested loop for narrow date ranges
 * (e.g. a 1-week report), which made reports_cierre_de_proveedores_conductor_elegido
 * run ~73s. The index lets the nested loop use an index scan and stabilizes the plan.
 *
 * Partial (parent_id IS NOT NULL): parent_id is NULL for top-level cases, and the join
 * only ever matches non-null values, so the partial index is smaller and equally usable.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }
    // Disable session statement_timeout so a long CONCURRENTLY build is not aborted on
    // environments that set a default timeout — an aborted build leaves the index INVALID.
    await knex.raw('SET statement_timeout = 0');
    // If a previous run was interrupted the index may exist as INVALID; IF NOT EXISTS would
    // short-circuit and we'd silently keep the unused INVALID index, so drop it first.
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_index i
                JOIN pg_class c ON c.oid = i.indexrelid
                WHERE c.relname = 'idx_cases_parent_id' AND NOT i.indisvalid
            ) THEN
                EXECUTE 'DROP INDEX idx_cases_parent_id';
            END IF;
        END
        $$;
    `);
    await knex.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_parent_id
        ON cases (parent_id)
        WHERE parent_id IS NOT NULL
    `);
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_cases_parent_id');
}

// CONCURRENTLY requires running outside a transaction; both up and down inherit this.
export const config = { transaction: false };
