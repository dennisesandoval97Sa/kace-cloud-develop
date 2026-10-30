import { serviceName } from '../env-config.js';
import { viewCasesV2 } from '../views/view_casesV2.js';
import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';
import { viewCasosV3 } from '../views/view_casosV3.js';
import { viewCasesDetailsV6 } from '../views/view_cases_details_v6.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw('DROP VIEW IF EXISTS view_casos');
    await knex.raw('DROP VIEW IF EXISTS view_case_details');

    await knex.raw(viewCasosV3('cases', 'clients'));
    await knex.raw(viewCasesDetailsV6('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw('DROP VIEW IF EXISTS view_casos');
    await knex.raw('DROP VIEW IF EXISTS view_case_details');

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}
