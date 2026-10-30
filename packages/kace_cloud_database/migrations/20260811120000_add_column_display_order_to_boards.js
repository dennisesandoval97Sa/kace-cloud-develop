/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // Sin backfill a proposito: con display_order en null el listado cae a created_at desc,
    // igual que antes de esta columna. El admin numera solo los tableros que quiera fijar arriba.
    await knex.schema.alterTable('boards', (table) => {
        table.integer('display_order').nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.dropColumn('display_order');
    });
}
