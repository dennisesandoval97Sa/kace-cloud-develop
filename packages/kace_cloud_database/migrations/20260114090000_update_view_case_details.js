import { serviceName } from '../env-config.js';
import { viewCasesDetailsV4 } from '../views/view_cases_details_v4.js';
import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw('DROP VIEW IF EXISTS view_case_details');

    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw('DROP VIEW IF EXISTS view_case_details');

    await knex.raw(viewCasesDetailsV4('cases', 'clients', 'aux_cases', serviceName));
}
