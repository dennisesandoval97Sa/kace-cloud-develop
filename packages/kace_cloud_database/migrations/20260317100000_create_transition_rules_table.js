/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('transition_rules', function (table) {
        table.string('id', 36).primary();
        table.string('nombre', 255).notNullable();
        table.jsonb('conditions').notNullable();
        table.smallint('status').notNullable().defaultTo(1);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).nullable();
        table.string('updated_by', 36).nullable();
        table.timestamp('deleted_at').nullable();
        table.string('deleted_by', 36).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('transition_rules');
}
