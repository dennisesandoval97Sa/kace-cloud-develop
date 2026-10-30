/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('aux_casos', function (table) {
        table.dropForeign('caso_id');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('aux_casos', function (table) {
        table.foreign('caso_id').references('id').inTable('casos');
    });
}
