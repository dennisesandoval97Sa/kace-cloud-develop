/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    await knex.schema.table('ws_rest_workflow_steps', (table) => {
        table.string('parent_step_id', 36).nullable();
        table.string('conditional_id', 36).nullable();
    });

}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    await knex.schema.table('ws_rest_workflow_steps', (table) => {
        table.dropColumn('parent_step_id');
        table.dropColumn('conditional_id');
    });

}
