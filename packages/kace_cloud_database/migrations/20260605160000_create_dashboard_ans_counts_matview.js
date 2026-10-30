/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }
    await knex.raw('SET statement_timeout = 0');

    // Conteo ANS global (single-row). Semántica idéntica a getAnsCountsFromView():
    // sobre cases no borrados; managed = resueltos (cualquier ans_posicion);
    // pending/to_overcome/defeated = NO resueltos por ans_posicion 1/2/3.
    // managed hereda deleted_at IS NULL del WHERE externo (resueltos no borrados).
    await knex.raw(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_ans_counts AS
        SELECT 1 AS id,
               count(*) FILTER (WHERE ans_posicion = 1 AND fecha_resolucion IS NULL) AS pending,
               count(*) FILTER (WHERE ans_posicion = 2 AND fecha_resolucion IS NULL) AS to_overcome,
               count(*) FILTER (WHERE ans_posicion = 3 AND fecha_resolucion IS NULL) AS defeated,
               count(*) FILTER (WHERE fecha_resolucion IS NOT NULL)                  AS managed
        FROM cases
        WHERE deleted_at IS NULL
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS mv_dashboard_ans_counts_uq
        ON mv_dashboard_ans_counts (id) NULLS NOT DISTINCT
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
    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_ans_counts');
}

// CREATE MATERIALIZED VIEW puebla al crearse; fuera de transacción para que un fallo
// parcial sea idempotente y retry-safe vía los guards IF NOT EXISTS.
export const config = { transaction: false };
