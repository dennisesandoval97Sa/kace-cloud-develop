/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.jsonb('access_users').nullable();
    });

    await knex('boards')
        .whereNull('access_users')
        .update({ access_users: JSON.stringify([]) });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.dropColumn('access_users');
    });
}
