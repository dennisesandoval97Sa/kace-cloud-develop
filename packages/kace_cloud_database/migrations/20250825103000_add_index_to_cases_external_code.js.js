import { serviceName } from '../env-config.js';
import { viewCases } from '../views/view_cases.js';
import { viewCasesDetailsV2 } from '../views/view_cases_details_v2.js';

/**
 * @param { import('knex').Knex } knex
 */
export async function up(knex) {
    await knex.schema.alterTable('cases', (table) => {
        table.index(['external_code'], 'idx_cases_external_code');
    });
}

/**
 * @param { import('knex').Knex } knex
 */
export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);

    await knex.schema.alterTable('cases', (table) => {
        table.dropIndex(['external_code'], 'idx_cases_external_code');
    });

    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV2('cases', 'clients', 'aux_cases', serviceName));
}
