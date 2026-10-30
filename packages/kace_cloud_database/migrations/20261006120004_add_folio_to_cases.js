import { viewCasosV7 } from '../views/view_casosV7.js';
import { viewCasesDetailsV10 } from '../views/view_cases_details_v10.js';
import { viewCasosV6 } from '../views/view_casosV6.js';
import { viewCasesDetailsV9 } from '../views/view_cases_details_v9.js';
import { serviceName } from '../env-config.js';

/**
 * Adds the configurable folio (radicado) column to cases.
 *
 * Both views list their columns explicitly, so they must be recreated for `folio` to
 * reach grids, reports and exports. The unique index lives in its own migration because
 * CONCURRENTLY cannot run inside a transaction.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.alterTable('cases', (table) => {
        table.string('folio', 100).nullable();
    });
    await knex.raw(viewCasosV7('cases', 'clients'));
    await knex.raw(viewCasesDetailsV10('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.alterTable('cases', (table) => {
        table.dropColumn('folio');
    });
    await knex.raw(viewCasosV6('cases', 'clients'));
    await knex.raw(viewCasesDetailsV9('cases', 'clients', 'aux_cases', serviceName));
}
