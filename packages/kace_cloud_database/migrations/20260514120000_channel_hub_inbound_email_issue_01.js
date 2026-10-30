/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('emails', (table) => {
        table.string('message_id', 255).alter();
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.string('client_identifier', 255).alter();
        table.string('external_identifier', 255).alter();
        table.string('conversation_id', 255).alter();
        table.string('email_id', 36).nullable();
        table.index('email_id');
        table.foreign('email_id').references('id').inTable('emails');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('interactions', (table) => {
        table.dropForeign(['email_id']);
        table.dropIndex(['email_id']);
        table.dropColumn('email_id');
    });
    // Keep provider-derived identifier columns widened on rollback.
    // Narrowing them back to 36 chars can fail or truncate data after Channel Hub stores non-UUID external IDs.
}
