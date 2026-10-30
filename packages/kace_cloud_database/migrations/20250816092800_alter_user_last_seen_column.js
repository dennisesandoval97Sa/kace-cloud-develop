import { viewCases } from '../views/view_cases.js';
import { viewCasesDetailsV2 } from '../views/view_cases_details_v2.js';
import { serviceName } from '../env-config.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.dropView('view_casos');
    await knex.schema.dropView('view_case_details');

    await knex.schema.alterTable('usuarios', (table) => {
        table.timestamp('last_seen_at').nullable();
    });

    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV2('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropView('view_casos');
    await knex.schema.dropView('view_case_details');

    await knex.schema.alterTable('usuarios', (table) => {
        table.dropColumn('last_seen_at');
    });

    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV2('cases', 'clients', 'aux_cases', serviceName));
}
