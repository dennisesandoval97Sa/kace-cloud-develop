export const CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE = 'channel_hub_workspace_priority_reorders';
export const CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_TABLE = 'channel_hub_workspace_priority_reorder_outbox';
export const CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_LEASE_INDEX = 'idx_channel_hub_workspace_priority_reorders_lease';
export const CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_DUE_INDEX =
    'idx_channel_hub_workspace_priority_reorder_outbox_due';

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE, (table) => {
        table.string('lease_owner_id', 36).nullable();
        table.timestamp('heartbeat_at').nullable();
        table.timestamp('lease_expires_at').nullable();
        table.timestamp('validated_at').nullable();
        table.index(['status', 'lease_expires_at'], CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_LEASE_INDEX);
    });
    await knex(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE)
        .where({ status: 'in_progress' })
        .update({
            validated_at: knex.raw('coalesce(started_at, updated_at, created_at)'),
            lease_expires_at: knex.raw('coalesce(updated_at, created_at)'),
        });

    await knex.schema.createTable(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_TABLE, (table) => {
        table.string('operation_id', 36).primary();
        table.string('event_id', 36).notNullable().unique();
        table.jsonb('event').notNullable();
        table.integer('publish_attempt_count').notNullable().defaultTo(0);
        table.timestamp('last_attempt_at').nullable();
        table.timestamp('next_attempt_at').notNullable().defaultTo(knex.fn.now());
        table.string('claim_owner_id', 36).nullable();
        table.timestamp('claim_expires_at').nullable();
        table.timestamp('published_at').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.index(
            ['published_at', 'next_attempt_at', 'claim_expires_at'],
            CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_DUE_INDEX
        );

        table
            .foreign('operation_id')
            .references('id')
            .inTable(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE)
            .onDelete('CASCADE');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTable(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_TABLE);
    await knex.schema.alterTable(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE, (table) => {
        table.dropColumn('lease_expires_at');
        table.dropColumn('heartbeat_at');
        table.dropColumn('lease_owner_id');
        table.dropColumn('validated_at');
    });
}
