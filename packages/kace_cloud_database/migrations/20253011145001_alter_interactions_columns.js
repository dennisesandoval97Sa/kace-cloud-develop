/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('interactions', (table) => {
        table.renameColumn('client_id', 'client_identifier');
        table.renameColumn('external_id', 'external_identifier');
        table.renameColumn('mailbox_id', 'workspace_id');

        table.boolean('is_closed');
        table.boolean('in_review');

        table.string('start_review_by', 36);
        table.string('closed_by', 36);
        table.timestamp('start_review_at');
        table.timestamp('closed_at');
        table.timestamp('receipt_at');
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.dropColumn('status');
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.foreign('workspace_id').references('id').inTable('workspaces');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('interactions', (table) => {
        table.dropForeign(['workspace_id']);
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.renameColumn('client_identifier', 'client_id');
        table.renameColumn('external_identifier', 'external_id');
        table.renameColumn('workspace_id', 'mailbox_id');

        table.string('status');
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.dropColumn('is_closed');
        table.dropColumn('in_review');
        table.dropColumn('start_review_by');
        table.dropColumn('start_review_at');
        table.dropColumn('closed_by');
        table.dropColumn('closed_at');
        table.dropColumn('receipt_at');
    });
}
