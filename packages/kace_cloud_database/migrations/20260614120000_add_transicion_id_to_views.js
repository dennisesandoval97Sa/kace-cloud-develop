import { serviceName } from '../env-config.js';
import { viewCasesV2 } from '../views/view_casesV2.js';
import { viewCasosV4 } from '../views/view_casosV4.js';
import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';
import { viewCasesDetailsV7 } from '../views/view_cases_details_v7.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw('DROP VIEW IF EXISTS view_casos');
    await knex.raw('DROP VIEW IF EXISTS view_case_details');

    await knex.raw(viewCasosV4('cases', 'clients'));
    await knex.raw(viewCasesDetailsV7('cases', 'clients', 'aux_cases', serviceName));
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
