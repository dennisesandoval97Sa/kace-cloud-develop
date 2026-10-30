/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.alterTable('transition_rules', (table) => {
        table.timestamp('created_at').alter().defaultTo(null);
        table.timestamp('updated_at').alter().defaultTo(null);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.alterTable('transition_rules', (table) => {
        table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
    });
}
