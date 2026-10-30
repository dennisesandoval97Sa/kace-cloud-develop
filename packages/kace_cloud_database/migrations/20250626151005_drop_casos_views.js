import { viewCases } from '../views/view_cases.js';
import { viewCasesDetails } from '../views/view_cases_details.js';
import { serviceName } from '../env-config.js';

/**
 * Eliminación de vistas antiguas basadas en nombres de tablas no normalizados.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw('DROP VIEW IF EXISTS view_casos;');
    await knex.raw('DROP VIEW IF EXISTS view_case_details;');
}

/**
 * Restauración de vistas antiguas si se hace rollback.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(viewCases('casos', 'clientes'));
    await knex.raw(viewCasesDetails('casos', 'clientes', 'aux_casos', serviceName));
}
