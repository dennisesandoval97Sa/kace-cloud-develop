import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import { up, down } from '../../migrations/20260701130000_backfill_channel_hub_rule_id_from_workspace_rules.js';

const RELATIONS_TABLE = 'workspaces_channel_hub_accounts_relations';

async function createSchema(db) {
    await db.schema.createTable('workspaces', (table) => {
        table.string('id', 36).primary();
        table.text('rules').nullable();
    });
    await db.schema.createTable(RELATIONS_TABLE, (table) => {
        table.string('workspace_id', 36).notNullable();
        table.string('channel_hub_account_id', 36).notNullable();
        table.string('channel_hub_rule_id', 36).nullable();
        table.primary(['workspace_id', 'channel_hub_account_id']);
    });
}

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await createSchema(db);
        await fn(db);
    } finally {
        await db.destroy();
    }
}

async function relationRuleId(db, workspaceId, accountId) {
    const row = await db(RELATIONS_TABLE)
        .where({ workspace_id: workspaceId, channel_hub_account_id: accountId })
        .first();
    return row?.channel_hub_rule_id ?? null;
}

test('up copies the legacy scalar rules.ruleId into the single relation row', async () => {
    await withDatabase(async (db) => {
        await db('workspaces').insert({ id: 'ws-legacy', rules: JSON.stringify({ ruleId: 'legacy-rule' }) });
        await db(RELATIONS_TABLE).insert({ workspace_id: 'ws-legacy', channel_hub_account_id: 'acc-1' });

        await up(db);

        assert.equal(await relationRuleId(db, 'ws-legacy', 'acc-1'), 'legacy-rule');
    });
});

test('up leaves relations that already have a rule id untouched', async () => {
    await withDatabase(async (db) => {
        await db('workspaces').insert({ id: 'ws-done', rules: JSON.stringify({ ruleId: 'legacy-rule' }) });
        await db(RELATIONS_TABLE).insert({
            workspace_id: 'ws-done',
            channel_hub_account_id: 'acc-1',
            channel_hub_rule_id: 'per-account-rule',
        });

        await up(db);

        assert.equal(await relationRuleId(db, 'ws-done', 'acc-1'), 'per-account-rule');
    });
});

test('up skips workspaces without a scalar ruleId or without rules', async () => {
    await withDatabase(async (db) => {
        await db('workspaces').insert([
            { id: 'ws-no-rule-id', rules: JSON.stringify({ ruleName: 'no id here' }) },
            { id: 'ws-null-rules', rules: null },
            { id: 'ws-blank-rule-id', rules: JSON.stringify({ ruleId: '   ' }) },
        ]);
        await db(RELATIONS_TABLE).insert([
            { workspace_id: 'ws-no-rule-id', channel_hub_account_id: 'acc-1' },
            { workspace_id: 'ws-null-rules', channel_hub_account_id: 'acc-2' },
            { workspace_id: 'ws-blank-rule-id', channel_hub_account_id: 'acc-3' },
        ]);

        await up(db);

        assert.equal(await relationRuleId(db, 'ws-no-rule-id', 'acc-1'), null);
        assert.equal(await relationRuleId(db, 'ws-null-rules', 'acc-2'), null);
        assert.equal(await relationRuleId(db, 'ws-blank-rule-id', 'acc-3'), null);
    });
});

test('up skips workspaces with more than one relation (ambiguous legacy rule owner)', async () => {
    await withDatabase(async (db) => {
        await db('workspaces').insert({ id: 'ws-multi', rules: JSON.stringify({ ruleId: 'legacy-rule' }) });
        await db(RELATIONS_TABLE).insert([
            { workspace_id: 'ws-multi', channel_hub_account_id: 'acc-1' },
            { workspace_id: 'ws-multi', channel_hub_account_id: 'acc-2' },
        ]);

        await up(db);

        assert.equal(await relationRuleId(db, 'ws-multi', 'acc-1'), null);
        assert.equal(await relationRuleId(db, 'ws-multi', 'acc-2'), null);
    });
});

test('down reverts only the rule ids that match the workspace legacy scalar', async () => {
    await withDatabase(async (db) => {
        await db('workspaces').insert([
            { id: 'ws-legacy', rules: JSON.stringify({ ruleId: 'legacy-rule' }) },
            { id: 'ws-own', rules: JSON.stringify({ ruleId: 'legacy-rule-own' }) },
        ]);
        await db(RELATIONS_TABLE).insert([
            { workspace_id: 'ws-legacy', channel_hub_account_id: 'acc-1' },
            {
                workspace_id: 'ws-own',
                channel_hub_account_id: 'acc-2',
                channel_hub_rule_id: 'independent-rule',
            },
        ]);

        await up(db);
        assert.equal(await relationRuleId(db, 'ws-legacy', 'acc-1'), 'legacy-rule');

        await down(db);

        assert.equal(await relationRuleId(db, 'ws-legacy', 'acc-1'), null);
        assert.equal(await relationRuleId(db, 'ws-own', 'acc-2'), 'independent-rule');
    });
});
