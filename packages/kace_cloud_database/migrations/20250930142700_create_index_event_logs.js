/**
 * @param { import('knex').Knex } knex
 */
export async function up(knex) {
    await knex.schema.alterTable('event_logs', (table) => {
        table.index(['case_id', 'occurred_at', 'event_name'], 'idx_cases_ocurred_at_event_name');
    });
}

/**
 * @param { import('knex').Knex } knex
 */
export async function down(knex) {
    await knex.schema.alterTable('event_logs', (table) => {
        table.dropIndex(['case_id', 'occurred_at', 'event_name'], 'idx_cases_ocurred_at_event_name');
    });
}
