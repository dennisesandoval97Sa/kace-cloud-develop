/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('allowed_connections', (table) => {
        table.boolean('has_ssl').notNullable().defaultTo(false);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('allowed_connections', (table) => {
        table.dropColumn('has_ssl');
    });
}
