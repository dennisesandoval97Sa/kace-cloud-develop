import { serviceName } from '../env-config.js';
import { viewCases } from '../views/view_cases.js';
import { viewCasesDetailsV2 } from '../views/view_cases_details_v2.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.alterTable('grupos', (table) => {
        table.string('codigo_externo', 500).alter();
    });
    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV2('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.alterTable('grupos', (table) => {
        table.string('codigo_externo', 45).alter();
    });
    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV2('cases', 'clients', 'aux_cases', serviceName));
}
