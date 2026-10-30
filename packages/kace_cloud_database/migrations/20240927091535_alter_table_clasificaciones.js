/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('clasificaciones', function (table) {
        table.bigInteger('default_group_id');
        table.string('external_id', 45);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('clasificaciones', function (table) {
        table.dropColumn('default_group_id');
        table.dropColumn('external_id');
    });
}
