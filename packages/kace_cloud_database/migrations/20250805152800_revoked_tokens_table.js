/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable('revoked_tokens', (table) => {
        table.uuid('id').primary();
        table.string('token_hash', 64).notNullable().unique();
        table.timestamp('revoked_at').defaultTo(knex.fn.now());
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('revoked_tokens');
}
