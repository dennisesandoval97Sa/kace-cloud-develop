/**
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
                WHERE c.relname = 'idx_cases_resolved' AND NOT i.indisvalid
            ) THEN
                EXECUTE 'DROP INDEX idx_cases_resolved';
            END IF;
        END
        $$;
    `);
    await knex.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_resolved
        ON cases (id)
        WHERE fecha_resolucion IS NOT NULL AND deleted_at IS NULL
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
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_cases_resolved');
}

// CONCURRENTLY requires running outside a transaction; both up and down inherit this.
export const config = { transaction: false };
