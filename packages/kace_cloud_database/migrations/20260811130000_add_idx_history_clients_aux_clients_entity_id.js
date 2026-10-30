/**
 * Adds btree indexes on (entity_id, created_at DESC) for history_clients and
 * history_aux_clients.
 *
 * Motivo: `createHistoryTable` (20241203142315_history_tables.js) crea las tablas de
 * historial únicamente con la PK sobre `id`, sin índice sobre `entity_id`. Como
 * `KnexRepository.searchHistory()` y `historyCounter()` siempre filtran por
 * `WHERE entity_id = ?`, cada consulta de historial recorre la tabla entera. En NATURA
 * PERÚ eso son 1 142 MB (history_aux_clients) y 839 MB (history_clients) de recorrido
 * secuencial por lectura. Ver .claude/docs/performance/loadtest-2026-08-07-natura-peru.md.
 *
 * El orden de columnas sigue el patrón de acceso real: igualdad sobre `entity_id` primero,
 * `created_at DESC` después para que el ORDER BY del listado paginado se sirva del propio
 * índice sin ordenación adicional.
 *
 * ⚠ La construcción sobre ~2 GB tarda. Aunque CONCURRENTLY no bloquea escrituras, conviene
 * aplicarla en ventana de baja actividad.
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

    const indexes = [
        ['idx_history_clients_entity_id', 'history_clients'],
        ['idx_history_aux_clients_entity_id', 'history_aux_clients'],
    ];

    for (const [name, table] of indexes) {
        // If a previous run was interrupted the index may exist as INVALID; IF NOT EXISTS
        // would short-circuit and we'd silently keep the unused INVALID index, so drop it
        // first. Scoped to current_schema(): index names repeat across tenant schemas.
        const invalid = await knex.raw(
            `SELECT 1
             FROM pg_index i
             JOIN pg_class c ON c.oid = i.indexrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = ? AND n.nspname = current_schema() AND NOT i.indisvalid`,
            [name]
        );
        if (invalid.rows.length > 0) {
            await knex.raw(`DROP INDEX ${name}`);
        }
        await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${table} (entity_id, created_at DESC)`);
    }
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_history_aux_clients_entity_id');
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_history_clients_entity_id');
}

// CONCURRENTLY requires running outside a transaction; both up and down inherit this.
export const config = { transaction: false };
