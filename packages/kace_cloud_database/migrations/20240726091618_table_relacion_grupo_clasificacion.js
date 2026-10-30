/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable('classification_group_relationships', function (table) {
        table.string('group_id', 36).notNullable();
        table.string('classification_id', 36).notNullable();
        table.string('form', 255);

        table.primary(['classification_id', 'group_id']);

        table.foreign('classification_id').references('id').inTable('clasificaciones');
        table.foreign('group_id').references('id').inTable('grupos');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('classification_group_relationships');
}
