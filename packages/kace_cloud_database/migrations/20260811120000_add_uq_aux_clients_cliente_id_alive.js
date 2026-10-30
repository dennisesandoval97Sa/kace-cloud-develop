/**
 * Adds a partial UNIQUE index on aux_clients(cliente_id) WHERE deleted_at IS NULL.
 *
 * Motivo: prueba de carga NATURA PERÚ 2026-08-07 — aux_clients solo tenía su clave
 * primaria y `findByClient` hacía un Parallel Seq Scan de 260 MB por búsqueda (la tabla
 * concentró, junto a clients, el 63 % del tiempo de BD). Ver
 * .claude/docs/performance/loadtest-2026-08-07-natura-peru.md.
 *
 * Además del rendimiento, el índice impone en la base de datos la regla de negocio
 * "un registro auxiliar vivo por cliente", cerrando el TOCTOU de AuxClientsCreator que
 * hoy solo se valida en aplicación (y que ya produjo duplicados reales).
 *
 * ⚠ Tenants EXISTENTES con duplicados vivos: la construcción falla con 23505 y deja el
 * índice INVALID. Hay que depurar los duplicados antes de migrar (soft delete de las
 * copias sobrantes, ver bloque 2 de tmp/2026-08-08-indices-clients-aux-clients-natura.sql)
 * y reejecutar la migración: el guard de abajo elimina el índice INVALID y reintenta.
 * Tenants nuevos pasan limpio.
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
    // If a previous run was interrupted (or the unique build failed on duplicates) the
    // index may exist as INVALID; IF NOT EXISTS would short-circuit and we'd silently
    // keep the unused INVALID index, so drop it first. Scoped to current_schema() so a
    // stale index in another tenant's schema can't trigger a drop here.
    await knex.raw(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_index i
                JOIN pg_class c ON c.oid = i.indexrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'uq_aux_clients_cliente_id'
                  AND n.nspname = current_schema()
                  AND NOT i.indisvalid
            ) THEN
                EXECUTE 'DROP INDEX uq_aux_clients_cliente_id';
            END IF;
        END
        $$;
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_aux_clients_cliente_id
        ON aux_clients (cliente_id)
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
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS uq_aux_clients_cliente_id');
}

// CONCURRENTLY requires running outside a transaction; both up and down inherit this.
export const config = { transaction: false };
