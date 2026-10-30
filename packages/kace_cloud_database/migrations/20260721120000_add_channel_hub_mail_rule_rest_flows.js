const TABLE = 'channel_hub_accounts';
const FLOWS_TABLE = 'ws_rest_flows';
const LIST_COLUMN = 'mail_rule_list_rest_flow_id';
const UPDATE_COLUMN = 'mail_rule_priority_update_rest_flow_id';

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    await knex.schema.alterTable(TABLE, (table) => {
        table.string(LIST_COLUMN, 36).nullable();
        table.string(UPDATE_COLUMN, 36).nullable();

        table.foreign(LIST_COLUMN).references('id').inTable(FLOWS_TABLE);
        table.foreign(UPDATE_COLUMN).references('id').inTable(FLOWS_TABLE);
    });
}

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    await knex.schema.alterTable(TABLE, (table) => {
        table.dropForeign(LIST_COLUMN);
        table.dropForeign(UPDATE_COLUMN);
        table.dropColumns(LIST_COLUMN, UPDATE_COLUMN);
    });
}
