import { serviceName } from '../env-config.js';
import { viewCasesDetailsV3 } from '../views/view_cases_details_v3.js';
import { viewCasesV2 } from '../views/view_casesV2.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);

    await knex.schema.alterTable('clasificaciones', function (table) {
        table.jsonb('json_flujo');
    });

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV3('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);

    await knex.schema.alterTable('clasificaciones', function (table) {
        table.dropColumn('json_flujo');
    });

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV3('cases', 'clients', 'aux_cases', serviceName));
}
