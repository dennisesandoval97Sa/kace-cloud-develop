
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('board_access_groups', function (table) {
        table.string('board_id', 36).notNullable()
        table.string('group_id', 36).notNullable();
        table.primary(['board_id', 'group_id']);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);


        table.foreign('board_id').references('id').inTable('boards');
        table.foreign('group_id').references('id').inTable('grupos');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('board_access_groups');
}
