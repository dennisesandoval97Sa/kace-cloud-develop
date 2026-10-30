/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('automated_assignment_runs', (table) => {
        table.string('id', 36).primary();
        table.timestamp('started_at').notNullable();
        table.timestamp('finished_at');
        table.integer('duration_ms');
        table.string('status', 32).notNullable();
        table.integer('actions_evaluated').notNullable().defaultTo(0);
        table.integer('candidates_total').notNullable().defaultTo(0);
        table.integer('assigned').notNullable().defaultTo(0);
        table.integer('skipped').notNullable().defaultTo(0);
        table.integer('errors').notNullable().defaultTo(0);
        table.integer('groups_without_capacity').notNullable().defaultTo(0);
        if (knex.client.config.client === 'sqlite3') {
            table.text('actions_detail');
            table.text('capacity_snapshot');
            table.text('error_detail');
        } else {
            table.jsonb('actions_detail');
            table.jsonb('capacity_snapshot');
            table.jsonb('error_detail');
        }
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('deleted_at');
        table.index(['started_at'], 'idx_automated_assignment_runs_started_at');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('automated_assignment_runs');
}
