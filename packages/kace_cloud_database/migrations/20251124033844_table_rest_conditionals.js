/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('ws_rest_conditionals', (table) => {
        table.string('id', 36).primary();
        table.string('satisfied', 36);
        table.string('unsatisfied', 36);
        table.string('input_path_a', 255);
        table.string('input_path_b', 255);
        table.string('operator', 20);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('created_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('ws_rest_conditionals');
}
