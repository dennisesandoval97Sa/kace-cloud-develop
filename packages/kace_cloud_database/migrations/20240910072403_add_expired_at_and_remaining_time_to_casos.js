/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('casos', (table) => {
        table.timestamp('expired_at');
        table.string('remaining_time', 255);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('casos', (table) => {
        table.dropColumn('expired_at');
        table.dropColumn('remaining_time');
    });
}
