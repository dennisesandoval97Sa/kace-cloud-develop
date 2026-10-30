/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const hasColumn = await knex.schema.hasColumn('emails_body', 'body_html');
    if (!hasColumn) {
        await knex.schema.alterTable('emails_body', (table) => {
            table.text('body_html').nullable();
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const hasColumn = await knex.schema.hasColumn('emails_body', 'body_html');
    if (hasColumn) {
        await knex.schema.alterTable('emails_body', (table) => {
            table.dropColumn('body_html');
        });
    }
}
