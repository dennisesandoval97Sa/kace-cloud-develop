import { quoteIdentifier } from './sqlIdentifier.js';

/**
 * Refresca una vista materializada del dashboard.
 *
 * `mv_dashboard_*` son vistas materializadas de verdad en el esquema migrado:
 * postgres rechaza cualquier INSERT/DELETE contra ellas, asi que la unica forma
 * de fijar los contadores desde un test es sembrar las tablas base y refrescar.
 * En produccion el refresco lo dispara el lambda dashboard-counts-refresh, que
 * usa `REFRESH MATERIALIZED VIEW CONCURRENTLY`
 * (`apps/apiv1/kace_cloud_api_dashboard_counts_refresh/src/EventController.mjs:61`);
 * aqui no hace falta CONCURRENTLY porque no hay lectores concurrentes y el
 * refresco no concurrente es mas rapido.
 *
 * El nombre se cita con `quoteIdentifier` en lugar de interpolarse: hoy los
 * llamadores pasan constantes del test, pero el identificador no admite binding
 * parametrizado y el patron no debe copiarse a un sitio donde el nombre venga
 * de una variable.
 *
 * @param {import('knex').Knex} connection - Conexion knex del archivo de test (`repository.connection`).
 * @param {string} matview - Nombre de la vista materializada a refrescar.
 * @returns {Promise<unknown>}
 */
export const refreshMatview = (connection, matview) =>
    connection.raw(`REFRESH MATERIALIZED VIEW ${quoteIdentifier(matview)}`);
