/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const hasColumn = await knex.schema.hasColumn('emails_attachments', 'filename');
    if (!hasColumn) {
        await knex.schema.alterTable('emails_attachments', (table) => {
            table.string('filename', 255).nullable();
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const hasColumn = await knex.schema.hasColumn('emails_attachments', 'filename');
    if (hasColumn) {
        await knex.schema.alterTable('emails_attachments', (table) => {
            table.dropColumn('filename');
        });
    }
}
