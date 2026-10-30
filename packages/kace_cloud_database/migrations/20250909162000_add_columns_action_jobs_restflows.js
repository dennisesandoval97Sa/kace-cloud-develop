/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('action_jobs', (table) => {
        table.string('restflow_id', 36).nullable();
        table.jsonb('restflow_context').nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('action_jobs', (table) => {
        table.dropColumn('restflow_id');
        table.dropColumn('restflow_context');
    });
}
