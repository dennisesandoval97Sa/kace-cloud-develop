/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('app_config', (table) => {
        table.string('id', 36).primary();
        table.string('description', 255).notNullable();
        table.string('type', 100);
        table.jsonb('config');
        table.smallint('status').defaultTo(1);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('app_config');
}
