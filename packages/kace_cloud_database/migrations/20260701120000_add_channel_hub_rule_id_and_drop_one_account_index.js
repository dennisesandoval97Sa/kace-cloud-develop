import { ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX } from './20260522200000_enforce_one_channel_hub_account_per_workspace.js';

const RELATIONS_TABLE = 'workspaces_channel_hub_accounts_relations';
export const CHANNEL_HUB_RULE_ID_COLUMN = 'channel_hub_rule_id';

/**
 * Enables multiple Channel Hub accounts per workspace (supersedes ADR-016):
 * - drops the one-account-per-workspace unique index left by 20260522200000, and
 * - adds a nullable `channel_hub_rule_id` column so each (workspace, account) relation
 *   stores its own Channel Hub rule id. NULL means "linked but not yet registered".
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`drop index if exists ${ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX}`);

    await knex.schema.alterTable(RELATIONS_TABLE, (table) => {
        table.string(CHANNEL_HUB_RULE_ID_COLUMN, 36).nullable();
    });
}

/**
 * The one-account-per-workspace unique index is intentionally NOT recreated: multi-account
 * rows may already exist and would violate it (rollbacks also run with data present). To
 * truly revert to ADR-016, clean up multi-account assignments and replay 20260522200000.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable(RELATIONS_TABLE, (table) => {
        table.dropColumn(CHANNEL_HUB_RULE_ID_COLUMN);
    });
}
