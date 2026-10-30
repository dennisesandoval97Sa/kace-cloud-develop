/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('event_deduplication', function (table) {
        table.string('event_id', 36).primary();
        table.string('event_name', 255).notNullable();
        table.string('aggregate_id', 36).notNullable();
        table.timestamp('processed_at').defaultTo(knex.fn.now());
        table.index(['event_name', 'aggregate_id']);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('event_deduplication');
}
