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

    // is_pending index: drop INVALID leftovers from prior failed run, then create
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_index i
                JOIN pg_class c ON c.oid = i.indexrelid
                WHERE c.relname = 'idx_action_jobs_is_pending' AND NOT i.indisvalid
            ) THEN
                EXECUTE 'DROP INDEX idx_action_jobs_is_pending';
            END IF;
        END
        $$;
    `);
    await knex.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_action_jobs_is_pending
        ON action_jobs (is_pending)
        WHERE deleted_at IS NULL AND is_pending = true
    `);

    // is_in_progress index: same hardening, separately
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_index i
                JOIN pg_class c ON c.oid = i.indexrelid
                WHERE c.relname = 'idx_action_jobs_is_in_progress' AND NOT i.indisvalid
            ) THEN
                EXECUTE 'DROP INDEX idx_action_jobs_is_in_progress';
            END IF;
        END
        $$;
    `);
    await knex.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_action_jobs_is_in_progress
        ON action_jobs (is_in_progress)
        WHERE deleted_at IS NULL AND is_in_progress = true
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
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_action_jobs_is_pending');
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_action_jobs_is_in_progress');
}

// CONCURRENTLY requires running outside a transaction; both up and down inherit this.
export const config = { transaction: false };
