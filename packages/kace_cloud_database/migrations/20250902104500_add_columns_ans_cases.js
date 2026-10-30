import { viewCases } from '../views/view_cases.js';
import { viewCasesDetailsV2 } from '../views/view_cases_details_v2.js';
import { serviceName } from '../env-config.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);

    await knex.schema.table('cases', (table) => {
        table.string('sla_id', 36).nullable();
        table.timestamp('sla_due_date', { useTz: true }).nullable();
        table.string('sla_elapsed_time', 255).nullable();
        table.integer('sla_elapsed_days').nullable();
        table.integer('sla_elapsed_hours').nullable();
        table.integer('sla_elapsed_minutes').nullable();
        table.string('sla_remaining_time', 255).nullable();
        table.integer('sla_remaining_days').nullable();
        table.integer('sla_remaining_hours').nullable();
        table.integer('sla_remaining_minutes').nullable();
        table.integer('sla_position').nullable();
        table.string('sla_state_id', 36).nullable();
        table.timestamp('sla_state_due_date', { useTz: true }).nullable();
        table.string('sla_state_elapsed_time', 255).nullable();
        table.integer('sla_state_elapsed_days').nullable();
        table.integer('sla_state_elapsed_hours').nullable();
        table.integer('sla_state_elapsed_minutes').nullable();
        table.string('sla_state_remaining_time', 255).nullable();
        table.integer('sla_state_remaining_days').nullable();
        table.integer('sla_state_remaining_hours').nullable();
        table.integer('sla_state_remaining_minutes').nullable();
        table.integer('sla_state_position').nullable();
    });

    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV2('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
    await knex.raw(`DROP VIEW IF EXISTS view_case_details`);

    await knex.schema.table('cases', (table) => {
        table.dropColumn('sla_id');
        table.dropColumn('sla_due_date');
        table.dropColumn('sla_elapsed_time');
        table.dropColumn('sla_elapsed_days');
        table.dropColumn('sla_elapsed_hours');
        table.dropColumn('sla_elapsed_minutes');
        table.dropColumn('sla_remaining_time');
        table.dropColumn('sla_remaining_days');
        table.dropColumn('sla_remaining_hours');
        table.dropColumn('sla_remaining_minutes');
        table.dropColumn('sla_position');
        table.dropColumn('sla_state_id');
        table.dropColumn('sla_state_due_date');
        table.dropColumn('sla_state_elapsed_time');
        table.dropColumn('sla_state_elapsed_days');
        table.dropColumn('sla_state_elapsed_hours');
        table.dropColumn('sla_state_elapsed_minutes');
        table.dropColumn('sla_state_remaining_time');
        table.dropColumn('sla_state_remaining_days');
        table.dropColumn('sla_state_remaining_hours');
        table.dropColumn('sla_state_remaining_minutes');
        table.dropColumn('sla_state_position');
    });

    await knex.raw(viewCases('cases', 'clients'));
    await knex.raw(viewCasesDetailsV2('cases', 'clients', 'aux_cases', serviceName));
}
