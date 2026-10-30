/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.boolean('can_view_record').defaultTo(true);
        table.boolean('can_create_record').defaultTo(true);
        table.boolean('can_edit_record').defaultTo(true);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.dropColumn('can_view_record');
        table.dropColumn('can_create_record');
        table.dropColumn('can_edit_record');
    });
}
