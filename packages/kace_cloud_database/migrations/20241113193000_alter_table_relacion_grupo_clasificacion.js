/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('classification_group_relationships', function (table) {
        table.string('form', 36).notNullable().alter();
        table.foreign('form').references('id').inTable('one-script');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema
        .alterTable('classification_group_relationships', function (table) {
            table.string('form', 255).alter();
        })
        .table('classification_group_relationships', function (table) {
            table.dropForeign('form');
        });
}
