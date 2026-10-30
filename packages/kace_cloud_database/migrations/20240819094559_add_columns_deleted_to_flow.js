/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('flujos', (table) => {
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('flujos', (table) => {
        table.dropColumn('deleted_at');
        table.dropColumn('deleted_by');
    });
}
