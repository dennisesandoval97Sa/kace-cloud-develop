/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable('rel_cases_subcases', (table) => {
        table.string('parent_case_id', 36).notNullable();
        table.string('child_case_id', 36).notNullable();

        table.primary(['parent_case_id', 'child_case_id']);

        table.foreign('parent_case_id').references('id').inTable('cases');

        table.foreign('child_case_id').references('id').inTable('cases');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTable('rel_cases_subcases');
}
