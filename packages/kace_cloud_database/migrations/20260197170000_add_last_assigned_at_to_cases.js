import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';
import { serviceName } from '../env-config.js';
import { viewCasesV2 } from '../views/view_casesV2.js';

export async function up(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.alterTable('cases', function (table) {
        table.timestamp('last_assigned_at');
    });

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}

export async function down(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.alterTable('cases', function (table) {
        table.dropColumn('last_assigned_at');
    });

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}
