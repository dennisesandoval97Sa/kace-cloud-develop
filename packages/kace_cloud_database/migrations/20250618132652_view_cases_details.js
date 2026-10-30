import { viewCasesDetails } from '../views/view_cases_details.js';
import { serviceName } from '../env-config.js';

export async function up(knex) {
    await knex.raw(viewCasesDetails('casos', 'clientes', 'aux_casos', serviceName));
}

export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
}
