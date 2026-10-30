/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('clasificaciones', function (table) {
        table.string('default_group_id', 36).alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('clasificaciones', function (table) {
        table.string('default_group_id').alter();
    });
}
