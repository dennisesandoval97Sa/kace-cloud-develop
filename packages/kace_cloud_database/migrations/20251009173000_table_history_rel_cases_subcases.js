/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('history_rel_cases_subcases', (table) => {
        table.string('id', 36).primary().notNullable();
        table.string('action', 20).notNullable();
        table.string('parent_case_id', 36).notNullable();
        table.string('child_case_id', 36).notNullable();
        table.timestamp('created_at');
        table.string('created_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('history_rel_cases_subcases');
}
