/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('custom_lists_groups_relations', (table) => {
    table.string('custom_list_id', 36).notNullable();
    table.string('group_id', 36).notNullable();

    table.primary(['custom_list_id', 'group_id']);

    table.foreign('custom_list_id').references('id').inTable('custom_lists');

    table.foreign('group_id').references('id').inTable('grupos')
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable('custom_lists_groups_relations');
}
