import { viewCases } from '../views/view_cases.js';
import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';
import { serviceName } from '../env-config.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.table('usuarios', (table) => {
        table.timestamp('last_integration_active_at').nullable();
    });
    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.table('usuarios', (table) => {
        table.dropColumn('last_integration_active_at');
    });
    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}
