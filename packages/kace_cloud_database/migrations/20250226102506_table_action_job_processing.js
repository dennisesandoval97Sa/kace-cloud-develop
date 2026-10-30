/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('action_job_processing', function (table) {
        table.string('id', 36).primary();
        table.string('job_id', 36);
        table.string('action_id', 36).notNullable();
        table.string('case_id', 36);
        table.string('client_id', 36);
        table.boolean('is_in_progress');
        table.boolean('is_completed');
        table.boolean('is_failed');
        table.timestamp('start_at');
        table.timestamp('end_at');
        table.jsonb('details');
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);

        table.foreign('case_id').references('id').inTable('casos');
        table.foreign('client_id').references('id').inTable('clientes');
        table.foreign('action_id').references('id').inTable('actions');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('action_job_processing');
}
