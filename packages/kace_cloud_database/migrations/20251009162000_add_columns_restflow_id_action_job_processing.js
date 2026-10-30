/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('action_job_processing', (table) => {
        table.string('restflow_id', 36).nullable();
        table.string('action_id').nullable().alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('action_job_processing', (table) => {
        table.dropColumn('restflow_id');
        table.string('action_id').notNullable().alter();
    });
}
