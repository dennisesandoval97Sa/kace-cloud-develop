/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('board_options', function (table) {
        table.string('id',36).primary();
        table.string('board_id',36)
        table.string('type',36)
        table.string('ref_id', 36)
        table.string('label', 120);
        table.boolean('requires_confirmation')
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
    return knex.schema.dropTable('board_options');
}
