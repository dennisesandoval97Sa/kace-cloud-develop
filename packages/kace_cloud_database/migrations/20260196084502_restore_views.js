import { serviceName } from '../env-config.js';
import { viewCasesV2 } from '../views/view_casesV2.js';
import { viewCasesDetailsV5 } from '../views/view_cases_details_v5.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.raw(viewCasesV2('cases', 'clients'));
    await knex.raw(viewCasesDetailsV5('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    console.warn('⚠️ Advertencia: Esta migración no puede revertirse. No se realizará ninguna acción.');
}
