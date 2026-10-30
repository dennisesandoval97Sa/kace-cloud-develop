import { viewCasesDetailsV7 } from '../views/view_cases_details_v7.js';
import { serviceName } from '../env-config.js';
import { viewCasosV4 } from '../views/view_casosV4.js';

export async function up(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');
    await knex.schema.alterTable('cases', (table) => {
        table.string('assignment_change_type', 36);
    });

    await knex.raw(viewCasosV4('cases', 'clients'));
    await knex.raw(viewCasesDetailsV7('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');
    await knex.schema.alterTable('cases', (table) => {
        table.dropColumn('assignment_change_type');
    });
    await knex.raw(viewCasosV4('cases', 'clients'));
    await knex.raw(viewCasesDetailsV7('cases', 'clients', 'aux_cases', serviceName));
}
