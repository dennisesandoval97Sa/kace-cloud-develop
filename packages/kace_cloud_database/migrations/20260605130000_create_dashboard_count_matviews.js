/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }
    await knex.raw('SET statement_timeout = 0');

    // Conteo por estado (casos abiertos, no borrados). Estado vía cases -> transiciones -> estados.
    await knex.raw(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_state_counts AS
        SELECT estados.id AS estado_id,
               estados.nombre AS estado_nombre,
               estados.icon_class AS icon_class,
               count(cases.id) AS total
        FROM cases
        JOIN transiciones ON transiciones.id = cases.transicion_id
        LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id
        WHERE cases.fecha_resolucion IS NULL AND cases.deleted_at IS NULL
        GROUP BY estados.id, estados.nombre, estados.icon_class
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS mv_dashboard_state_counts_uq
        ON mv_dashboard_state_counts (estado_id) NULLS NOT DISTINCT
    `);

    // Conteo por grupo x estado (preserva semántica actual: sin filtro de resolucion/borrado).
    await knex.raw(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_group_counts AS
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
        CREATE UNIQUE INDEX IF NOT EXISTS mv_dashboard_group_counts_uq
        ON mv_dashboard_group_counts (grupo_id, estado_id) NULLS NOT DISTINCT
    `);

    // Conteo por responsable x estado (preserva semántica actual).
    await knex.raw(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_responsible_counts AS
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
        CREATE UNIQUE INDEX IF NOT EXISTS mv_dashboard_responsible_counts_uq
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
    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_responsible_counts');
    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_group_counts');
    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_state_counts');
}

// CREATE MATERIALIZED VIEW populates on creation; run outside a transaction so a partial
// failure is idempotently retry-safe via the IF NOT EXISTS guards on each create/index pair.
export const config = { transaction: false };
