import { serviceName } from '../env-config.js';
import { viewCasosV5 } from '../views/view_casosV5.js';
import { viewCasosV6 } from '../views/view_casosV6.js';
import { viewCasesDetailsV8 } from '../views/view_cases_details_v8.js';
import { viewCasesDetailsV9 } from '../views/view_cases_details_v9.js';

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.raw(viewCasosV6('cases', 'clients'));
    await knex.raw(viewCasesDetailsV9('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.raw(viewCasosV5('cases', 'clients'));
    await knex.raw(viewCasesDetailsV8('cases', 'clients', 'aux_cases', serviceName));
}
