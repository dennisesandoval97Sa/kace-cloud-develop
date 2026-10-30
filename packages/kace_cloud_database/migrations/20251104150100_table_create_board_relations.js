/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('board_relations', function (table) {
        table.string('id').primary();
        table.string('board_id',36)
        table.string('related_entity', 80)
        table.string('join_type', 80)
        table.jsonb('on')
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.foreign('board_id').references('id').inTable('boards');

    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('board_relations');
}
