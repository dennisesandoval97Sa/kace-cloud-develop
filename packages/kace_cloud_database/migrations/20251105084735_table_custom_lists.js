/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('custom_lists', function (table) {
        table.string('id', 36).primary().notNullable();
        table.string('name', 255);
        table.boolean('is_active');
        table.string('aux_entity', 128);
        table.string('created_by', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);

    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('custom_lists');
}
