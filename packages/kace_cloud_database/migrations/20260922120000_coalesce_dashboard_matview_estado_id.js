/**
 * Alinea las matviews del dashboard con las vistas de casos: el estado se resuelve
 * con COALESCE(transiciones.siguiente_estado_id, cases.estado_id). Sin eso, un caso
 * abierto cuya transición no tiene siguiente_estado_id aparece en la tabla y no
 * incrementa el conteo del dashboard.
 *
 * Conserva el filtro de casos abiertos de 20260609120000.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }
    await knex.raw('SET statement_timeout = 0');

    const estadoId = 'COALESCE(transiciones.siguiente_estado_id, cases.estado_id)';

    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_state_counts CASCADE');
    await knex.raw(`
        CREATE MATERIALIZED VIEW mv_dashboard_state_counts AS
        SELECT estados.id AS estado_id,
               estados.nombre AS estado_nombre,
               estados.icon_class AS icon_class,
               count(cases.id) AS total
        FROM cases
        JOIN transiciones ON transiciones.id = cases.transicion_id
        LEFT JOIN estados ON estados.id = ${estadoId}
        WHERE cases.fecha_resolucion IS NULL AND cases.deleted_at IS NULL
        GROUP BY estados.id, estados.nombre, estados.icon_class
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX mv_dashboard_state_counts_uq
        ON mv_dashboard_state_counts (estado_id) NULLS NOT DISTINCT
    `);

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
        LEFT JOIN estados ON estados.id = ${estadoId}
        WHERE cases.fecha_resolucion IS NULL
          AND cases.deleted_at IS NULL
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
        LEFT JOIN estados ON estados.id = ${estadoId}
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
 * Restaura las definiciones de 20260609120000 (casos abiertos, join solo a siguiente_estado_id).
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }
    await knex.raw('SET statement_timeout = 0');

    await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_state_counts CASCADE');
    await knex.raw(`
        CREATE MATERIALIZED VIEW mv_dashboard_state_counts AS
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
        CREATE UNIQUE INDEX mv_dashboard_state_counts_uq
        ON mv_dashboard_state_counts (estado_id) NULLS NOT DISTINCT
    `);

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

export const config = { transaction: false };
