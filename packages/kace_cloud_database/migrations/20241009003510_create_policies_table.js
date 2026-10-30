/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('policies', function (table) {
        table.string('id', 36).primary();
        table.string('title', 100).notNullable();
        table.string('provider', 50).notNullable();
        table.string('effect', 10).notNullable();
        table.jsonb('operations');
        table.jsonb('actions');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('policies');
}
