import { viewCases } from '../views/view_cases.js';
import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';
import { serviceName } from '../env-config.js';

/**
 * Adds columns to cache Cognito id_tokens for service accounts.
 * This avoids redundant Cognito calls during RestFlow execution
 * by persisting the id_token (60min TTL) keyed by service-account user.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.table('usuarios', (table) => {
        table.text('cognito_id_token').nullable();
        table.timestamp('cognito_id_token_cached_at').nullable();
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
        table.dropColumn('cognito_id_token');
        table.dropColumn('cognito_id_token_cached_at');
    });
    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}
