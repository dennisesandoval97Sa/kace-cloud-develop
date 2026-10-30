/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('custom_lists_auxiliar_relations', function (table) {
        table.string('id', 36).primary().notNullable();
        table.string('custom_list_id', 36);
        table.string('aux_id', 36);
        table.integer('order');

        table
        .foreign('custom_list_id')
        .references('id')
        .inTable('custom_lists')
        .onDelete('CASCADE');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('custom_lists_auxiliar_relations');
}
