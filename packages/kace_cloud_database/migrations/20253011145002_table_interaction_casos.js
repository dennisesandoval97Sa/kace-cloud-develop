/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('interaction_casos', function (table) {
        table.string('interaction_id', 36).notNullable();
        table.string('caso_id', 36).notNullable();
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);

        table.primary(['interaction_id', 'caso_id']);

        table.foreign('interaction_id').references('id').inTable('interactions');
        table.foreign('caso_id').references('id').inTable('cases');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('interaction_casos');
}
