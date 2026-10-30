const RELATIONS_TABLE = 'workspaces_channel_hub_accounts_relations';

const legacyRuleIdExpr = (knex) => {
    const client = String(knex.client?.config?.client ?? '');
    return client.includes('sqlite')
        ? "NULLIF(TRIM(json_extract(w.rules, '$.ruleId')), '')"
        : "NULLIF(BTRIM((w.rules::jsonb)->>'ruleId'), '')";
};

/**
 * Backfills the per-account `channel_hub_rule_id` from the legacy scalar
 * `workspaces.rules.ruleId` (ADR-016 era). Only workspaces with exactly one
 * relation row are backfilled: pre-ADR-017 data cannot have more, and with
 * several relations the legacy rule owner would be ambiguous.
 *
 * The scalar is kept in the JSON as a read fallback for not-yet-deployed readers.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const ruleId = legacyRuleIdExpr(knex);
    await knex.raw(`
        UPDATE ${RELATIONS_TABLE}
        SET channel_hub_rule_id = (
            SELECT ${ruleId} FROM workspaces w WHERE w.id = ${RELATIONS_TABLE}.workspace_id
        )
        WHERE channel_hub_rule_id IS NULL
        AND (
            SELECT ${ruleId} FROM workspaces w WHERE w.id = ${RELATIONS_TABLE}.workspace_id
        ) IS NOT NULL
        AND (
            SELECT COUNT(*) FROM ${RELATIONS_TABLE} r2
            WHERE r2.workspace_id = ${RELATIONS_TABLE}.workspace_id
        ) = 1
    `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const ruleId = legacyRuleIdExpr(knex);
    await knex.raw(`
        UPDATE ${RELATIONS_TABLE}
        SET channel_hub_rule_id = NULL
        WHERE channel_hub_rule_id = (
            SELECT ${ruleId} FROM workspaces w WHERE w.id = ${RELATIONS_TABLE}.workspace_id
        )
    `);
}
