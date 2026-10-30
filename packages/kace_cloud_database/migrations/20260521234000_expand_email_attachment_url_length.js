/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('emails_attachments', (table) => {
        table.string('url', 1000).nullable().alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('emails_attachments', (table) => {
        table.string('url', 255).nullable().alter();
    });
}
