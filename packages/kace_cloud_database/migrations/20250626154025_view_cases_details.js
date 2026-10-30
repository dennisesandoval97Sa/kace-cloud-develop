import { viewCasesDetails } from '../views/view_cases_details.js';
import { serviceName } from '../env-config.js';

export async function up(knex) {
    await knex.raw(viewCasesDetails('cases', 'clients', 'aux_cases', serviceName));
}

export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
}
