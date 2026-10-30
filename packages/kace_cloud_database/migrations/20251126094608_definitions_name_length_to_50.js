/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('aux_definitions', function (table) {
        table.string('name', 50).alter();
        table.string('tablename', 63).alter();
        table.string('logs_tablename', 63).alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('aux_definitions', function (table) {
        table.string('name', 45).alter();
        table.string('tablename', 45).alter();
        table.string('logs_tablename', 45).alter();
    });
}
