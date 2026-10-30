/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('boveda_secretos', (table) => {
        table.boolean('password_encryption_migrated');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('boveda_secretos', (table) => {
        table.dropColumn('password_encryption_migrated');
    });
}
