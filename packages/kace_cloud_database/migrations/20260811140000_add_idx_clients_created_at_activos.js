/**
 * Adds a partial btree index on clients(created_at DESC) for non-deleted rows.
 *
 * Motivo: prueba de carga NATURA PERÚ 2026-08-07 — `clients` solo tenía su clave primaria
 * y el listado paginado resolvía con Parallel Seq Scan + top-N heapsort sobre 510 957 filas
 * (19 284 buffers ≈ 150 MB por ejecución, 311 ms de media y 1 477 ms de máximo). Ver
 * .claude/docs/performance/loadtest-2026-08-07-natura-peru.md.
 *
 * El índice permite recorrer el orden ya materializado y parar en el LIMIT.
 *
 * El predicado parcial replica exactamente el filtro de `KnexClientRepository.search()`,
 * que añade `whereNull('deleted_by')` sobre el `deleted_at IS NULL` que aporta el criteria.
 * Ambas condiciones deben estar presentes en la consulta para que el planificador pueda
 * usar el índice.
 *
 * ⚠ Esto NO acelera `KnexClientRepository.count()`: ese método no añade el
 * `whereNull('deleted_by')`, así que su predicado es más amplio que el del índice y el
 * planificador no puede usarlo. Contar el total seguirá siendo un recorrido completo; la
 * solución está en la aplicación (no pedir el total exacto en cada página, o un conteo
 * aproximado), no en un índice adicional.
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
    // Scoped to current_schema(): index names repeat across tenant schemas.
    const invalid = await knex.raw(
        `SELECT 1
         FROM pg_index i
         JOIN pg_class c ON c.oid = i.indexrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relname = ? AND n.nspname = current_schema() AND NOT i.indisvalid`,
        ['idx_clients_created_at_activos']
    );
    if (invalid.rows.length > 0) {
        await knex.raw('DROP INDEX idx_clients_created_at_activos');
    }
    await knex.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_created_at_activos
        ON clients (created_at DESC)
        WHERE deleted_at IS NULL AND deleted_by IS NULL
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
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_clients_created_at_activos');
}

// CONCURRENTLY requires running outside a transaction; both up and down inherit this.
export const config = { transaction: false };
