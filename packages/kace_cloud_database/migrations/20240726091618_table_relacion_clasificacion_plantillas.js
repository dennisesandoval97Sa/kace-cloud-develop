/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('classification_template_relations', (table) => {
        table.string('classification_id', 36).notNullable();
        table.string('template_id', 36).notNullable();

        table.primary(['classification_id', 'template_id']);
        table.foreign('classification_id').references('id').inTable('clasificaciones');
        table.foreign('template_id').references('id').inTable('plantillas');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('classification_template_relations');
}
