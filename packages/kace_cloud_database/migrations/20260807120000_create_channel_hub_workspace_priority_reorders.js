export const CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE = 'channel_hub_workspace_priority_reorders';
export const ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_INDEX =
    'uq_channel_hub_workspace_priority_reorders_active_account';
export const CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_STATUSES = ['pending', 'in_progress', 'completed', 'failed'];

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE, (table) => {
        table.string('id', 36).primary();
        table.string('channel_hub_account_id', 36).notNullable();
        table.string('revision', 64).notNullable();
        table.jsonb('ordered_workspace_ids').notNullable();
        table.jsonb('result').nullable();
        table
            .enu('status', CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_STATUSES, {
                useNative: false,
                enumName: 'channel_hub_workspace_priority_reorder_status',
            })
            .notNullable()
            .defaultTo('pending');
        table.integer('attempt_count').notNullable().defaultTo(0);
        table.string('error_code', 128).nullable();
        table.string('error_message', 500).nullable();
        table.timestamp('started_at').nullable();
        table.timestamp('completed_at').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.string('created_by', 36).nullable();
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        table.string('updated_by', 36).nullable();

        table.foreign('channel_hub_account_id').references('id').inTable('channel_hub_accounts').onDelete('CASCADE');
    });

    await knex.raw(
        `create unique index ${ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_INDEX} ` +
            `on ${CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE} (channel_hub_account_id) ` +
            "where status in ('pending', 'in_progress')"
    );
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTable(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE);
}
