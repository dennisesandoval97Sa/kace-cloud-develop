/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('automated_assignment_backlog_snapshots', (table) => {
        // Caché descartable del último conteo por regla: sin FK a actions a propósito.
        table.string('action_id', 36).primary();
        table.integer('backlog');
        table.timestamp('computed_at').notNullable();
        table.integer('duration_ms');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('automated_assignment_backlog_snapshots');
}
