import { serviceName } from '../env-config.js';
import { viewCasesDetailsV3 } from '../views/view_cases_details_v3.js';
import { viewCasesDetailsV4 } from '../views/view_cases_details_v4.js';
import { viewCasesV2 } from '../views/view_casesV2.js';
import { viewCases } from '../views/view_cases.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);

    await knex.schema.table('grupos', (table) => {
        table.jsonb('data').nullable();
        table.jsonb('ips_allowed').nullable();
    });

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV4('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);

    await knex.schema.table('grupos', (table) => {
        table.dropColumn('data');
        table.dropColumn('ips_allowed');
    });

    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV3('cases', 'clients', 'aux_cases', serviceName));
}
