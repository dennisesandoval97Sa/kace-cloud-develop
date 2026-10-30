/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    if (knex.client.config.client === 'sqlite3') {
        await knex.schema.alterTable('casos', (table) => {
            table.integer('reference');
        });
    } else {
        await knex.schema.alterTable('casos', (table) => {
            table.specificType('reference', 'SERIAL').unique();
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('casos', (table) => {
        table.dropColumn('reference');
    });
}
