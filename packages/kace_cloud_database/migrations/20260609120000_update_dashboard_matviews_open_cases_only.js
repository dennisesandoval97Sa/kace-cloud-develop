/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }
    await knex.raw('SET statement_timeout = 0');

    // Recreate group counts MV filtering to open cases only (fecha_resolucion IS NULL).
    // The original definition counted all cases regardless of resolution status.
    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_group_counts CASCADE');
    await knex.raw(`
        CREATE MATERIALIZED VIEW mv_dashboard_group_counts AS
        SELECT grupos.id AS grupo_id,
               grupos.nombre AS grupo_nombre,
               estados.id AS estado_id,
               estados.nombre AS estado_nombre,
               count(cases.id) AS total
        FROM cases
        JOIN grupos ON grupos.id = cases.grupo_id
        JOIN transiciones ON transiciones.id = cases.transicion_id
        LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id
        WHERE cases.fecha_resolucion IS NULL
          AND cases.deleted_at IS NULL
        GROUP BY grupos.id, grupos.nombre, estados.id, estados.nombre
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX mv_dashboard_group_counts_uq
        ON mv_dashboard_group_counts (grupo_id, estado_id) NULLS NOT DISTINCT
    `);

    // Recreate responsible counts MV filtering to open cases only (fecha_resolucion IS NULL).
    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_responsible_counts CASCADE');
    await knex.raw(`
        CREATE MATERIALIZED VIEW mv_dashboard_responsible_counts AS
        SELECT responsable.id AS responsable_id,
               CONCAT(responsable.nombres, ' ', responsable.apellido1) AS responsable_nombre,
               estados.id AS estado_id,
               estados.nombre AS estado_nombre,
               count(cases.id) AS total
        FROM cases
        JOIN usuarios responsable ON responsable.id = cases.responsable_id
        JOIN transiciones ON transiciones.id = cases.transicion_id
        LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id
        WHERE cases.fecha_resolucion IS NULL
          AND cases.deleted_at IS NULL
        GROUP BY responsable.id, CONCAT(responsable.nombres, ' ', responsable.apellido1), estados.id, estados.nombre
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX mv_dashboard_responsible_counts_uq
        ON mv_dashboard_responsible_counts (responsable_id, estado_id) NULLS NOT DISTINCT
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

    // Restore original definition without the open-cases filter.
    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_group_counts CASCADE');
    await knex.raw(`
        CREATE MATERIALIZED VIEW mv_dashboard_group_counts AS
        SELECT grupos.id AS grupo_id,
               grupos.nombre AS grupo_nombre,
               estados.id AS estado_id,
               estados.nombre AS estado_nombre,
               count(cases.id) AS total
        FROM cases
        JOIN grupos ON grupos.id = cases.grupo_id
        JOIN transiciones ON transiciones.id = cases.transicion_id
        LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id
        GROUP BY grupos.id, grupos.nombre, estados.id, estados.nombre
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX mv_dashboard_group_counts_uq
        ON mv_dashboard_group_counts (grupo_id, estado_id) NULLS NOT DISTINCT
    `);

    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_responsible_counts CASCADE');
    await knex.raw(`
        CREATE MATERIALIZED VIEW mv_dashboard_responsible_counts AS
        SELECT responsable.id AS responsable_id,
               CONCAT(responsable.nombres, ' ', responsable.apellido1) AS responsable_nombre,
               estados.id AS estado_id,
               estados.nombre AS estado_nombre,
               count(cases.id) AS total
        FROM cases
        JOIN usuarios responsable ON responsable.id = cases.responsable_id
        JOIN transiciones ON transiciones.id = cases.transicion_id
        LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id
        GROUP BY responsable.id, CONCAT(responsable.nombres, ' ', responsable.apellido1), estados.id, estados.nombre
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX mv_dashboard_responsible_counts_uq
        ON mv_dashboard_responsible_counts (responsable_id, estado_id) NULLS NOT DISTINCT
    `);
}

// DROP + CREATE MATERIALIZED VIEW must run outside a transaction — partial failures
// are idempotently retry-safe because a failed DROP leaves the old MV intact.
export const config = { transaction: false };
