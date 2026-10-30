/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await assertNoDuplicateEmails(knex);
    await assertNoDuplicateInteractions(knex);

    await knex.schema.alterTable('emails', (table) => {
        table.unique(['workspace_id', 'message_id'], 'emails_workspace_message_id_unique');
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.unique(['email_id'], 'interactions_email_id_unique');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('interactions', (table) => {
        table.dropUnique(['email_id'], 'interactions_email_id_unique');
    });

    await knex.schema.alterTable('emails', (table) => {
        table.dropUnique(['workspace_id', 'message_id'], 'emails_workspace_message_id_unique');
    });
}

async function assertNoDuplicateEmails(knex) {
    const duplicates = await knex('emails')
        .select('workspace_id', 'message_id')
        .count({ count: '*' })
        .whereNotNull('workspace_id')
        .whereNotNull('message_id')
        .groupBy('workspace_id', 'message_id')
        .havingRaw('COUNT(*) > 1');

    if (duplicates.length > 0) {
        throw new Error(
            `Cannot add Channel Hub inbound email idempotency constraint: duplicate emails exist for workspace_id/message_id. ` +
                `Resolve duplicates before migrating. Examples: ${formatDuplicateExamples(
                    duplicates,
                    (row) => `workspace_id=${row.workspace_id}, message_id=${row.message_id}, count=${row.count}`
                )}`
        );
    }
}

async function assertNoDuplicateInteractions(knex) {
    const duplicates = await knex('interactions')
        .select('email_id')
        .count({ count: '*' })
        .whereNotNull('email_id')
        .groupBy('email_id')
        .havingRaw('COUNT(*) > 1');

    if (duplicates.length > 0) {
        throw new Error(
            `Cannot add Channel Hub inbound email interaction idempotency constraint: duplicate interactions exist for email_id. ` +
                `Resolve duplicates before migrating. Examples: ${formatDuplicateExamples(
                    duplicates,
                    (row) => `email_id=${row.email_id}, count=${row.count}`
                )}`
        );
    }
}

function formatDuplicateExamples(duplicates, formatRow) {
    return duplicates.slice(0, 5).map(formatRow).join('; ');
}
