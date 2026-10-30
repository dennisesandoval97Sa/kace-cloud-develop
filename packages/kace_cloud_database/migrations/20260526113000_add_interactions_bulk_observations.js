/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.alterTable('interactions', (table) => {
        table.text('closed_observation');
        table.text('delete_observation');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.alterTable('interactions', (table) => {
        table.dropColumn('closed_observation');
        table.dropColumn('delete_observation');
    });
}
