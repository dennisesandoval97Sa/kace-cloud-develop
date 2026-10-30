/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable('classifications_subclassifications_relationships', function (table) {
        table.string('classification_id', 36);
        table.string('sub_classification_id', 36);
        table.primary(['classification_id', 'sub_classification_id']);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('classifications_subclassifications_relationships');
}
