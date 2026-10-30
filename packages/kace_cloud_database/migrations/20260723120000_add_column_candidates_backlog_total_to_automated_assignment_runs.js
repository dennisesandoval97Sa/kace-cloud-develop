/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.alterTable('automated_assignment_runs', (table) => {
        // Nullable on purpose: runs persisted before this migration have no backlog value,
        // so null means "not available" (historical), distinct from a real 0.
        table.integer('candidates_backlog_total');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.alterTable('automated_assignment_runs', (table) => {
        table.dropColumn('candidates_backlog_total');
    });
}
