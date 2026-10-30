import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';
import { serviceName } from '../env-config.js';
import { viewCasesV2 } from '../views/view_casesV2.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.table('usuarios', (table) => {
        table.boolean('password_encryption_migrated');
    });

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.table('usuarios', (table) => {
        table.dropColumn('password_encryption_migrated');
    });

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}
