import { viewCasesDetailsV8 } from '../views/view_cases_details_v8.js';
import { viewCasesDetailsV7 } from '../views/view_cases_details_v7.js';
import { serviceName } from '../env-config.js';
import { viewCasosV5 } from '../views/view_casosV5.js';
import { viewCasosV4 } from '../views/view_casosV4.js';

export async function up(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.alterTable('cases', (table) => {
        table.string('edited_by', 36).nullable();
        table.timestamp('edited_at').nullable();
    });

    await knex.schema.alterTable('fake_cases', (table) => {
        table.string('edited_by', 36).nullable();
        table.timestamp('edited_at').nullable();
    });

    await knex.raw(viewCasosV5('cases', 'clients'));
    await knex.raw(viewCasesDetailsV8('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.alterTable('cases', (table) => {
        table.dropColumn('edited_by');
        table.dropColumn('edited_at');
    });

    await knex.schema.alterTable('fake_cases', (table) => {
        table.dropColumn('edited_by');
        table.dropColumn('edited_at');
    });

    await knex.raw(viewCasosV4('cases', 'clients'));
    await knex.raw(viewCasesDetailsV7('cases', 'clients', 'aux_cases', serviceName));
}
