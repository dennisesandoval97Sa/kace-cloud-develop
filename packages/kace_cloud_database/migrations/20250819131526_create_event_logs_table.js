/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('event_logs', function (table) {
        table.string('id', 36).primary();
        table.string('event_name', 255);
        table.timestamp('occurred_at');
        table.string('initiated_by_user', 36);
        table.string('aggregate_id', 36);
        table.jsonb('body');
        table.string('case_id', 36);
        table.string('client_id', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('event_logs');
}
