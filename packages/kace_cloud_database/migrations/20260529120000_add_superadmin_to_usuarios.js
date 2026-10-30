import { viewCases } from '../views/view_cases.js';
import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';
import { serviceName } from '../env-config.js';

export async function up(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.table('usuarios', (table) => {
        table.boolean('superadmin').notNullable().defaultTo(false);
    });
    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}

export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);
    await knex.schema.table('usuarios', (table) => {
        table.dropColumn('superadmin');
    });
    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}
