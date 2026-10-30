import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import {
    ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX,
    up,
    down,
} from '../../migrations/20260522200000_enforce_one_channel_hub_account_per_workspace.js';

const WORKSPACE_A = 'workspace-a';
const WORKSPACE_B = 'workspace-b';
const ACCOUNT_A = 'account-a';
const ACCOUNT_B = 'account-b';

async function createSchema(db) {
    await db.schema.createTable('workspaces', (table) => {
        table.string('id', 36).primary();
    });

    await db.schema.createTable('channel_hub_accounts', (table) => {
        table.string('id', 36).primary();
    });

    await db.schema.createTable('workspaces_channel_hub_accounts_relations', (table) => {
        table.string('workspace_id', 36).notNullable();
        table.string('channel_hub_account_id', 36).notNullable();
        table.primary(['workspace_id', 'channel_hub_account_id']);
    });
}

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await createSchema(db);
        await db('workspaces').insert([{ id: WORKSPACE_A }, { id: WORKSPACE_B }]);
        await db('channel_hub_accounts').insert([{ id: ACCOUNT_A }, { id: ACCOUNT_B }]);
        await fn(db);
    } finally {
        await db.destroy();
    }
}

async function indexExists(db) {
    const indexes = await db.raw(`PRAGMA index_list('workspaces_channel_hub_accounts_relations')`);
    return indexes.some((index) => index.name === ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX);
}

test('up allows one account per workspace while allowing the same account across workspaces', async () => {
    await withDatabase(async (db) => {
        await db('workspaces_channel_hub_accounts_relations').insert([
            { workspace_id: WORKSPACE_A, channel_hub_account_id: ACCOUNT_A },
            { workspace_id: WORKSPACE_B, channel_hub_account_id: ACCOUNT_A },
        ]);

        await up(db);

        assert.equal(await indexExists(db), true);
        await assert.rejects(
            db('workspaces_channel_hub_accounts_relations').insert({
                workspace_id: WORKSPACE_A,
                channel_hub_account_id: ACCOUNT_B,
            }),
            /unique|constraint/i
        );
    });
});

test('up fails before adding the index when a workspace already has multiple accounts', async () => {
    await withDatabase(async (db) => {
        await db('workspaces_channel_hub_accounts_relations').insert([
            { workspace_id: WORKSPACE_A, channel_hub_account_id: ACCOUNT_A },
            { workspace_id: WORKSPACE_A, channel_hub_account_id: ACCOUNT_B },
        ]);

        await assert.rejects(up(db), /Clean up duplicate Channel Hub account assignments first: workspace-a/);
        assert.equal(await indexExists(db), false);
    });
});

test('down drops only the one-account-per-workspace unique index', async () => {
    await withDatabase(async (db) => {
        await db('workspaces_channel_hub_accounts_relations').insert({
            workspace_id: WORKSPACE_A,
            channel_hub_account_id: ACCOUNT_A,
        });

        await up(db);
        assert.equal(await indexExists(db), true);

        await down(db);
        assert.equal(await indexExists(db), false);

        await db('workspaces_channel_hub_accounts_relations').insert({
            workspace_id: WORKSPACE_A,
            channel_hub_account_id: ACCOUNT_B,
        });

        await assert.rejects(
            db('workspaces_channel_hub_accounts_relations').insert({
                workspace_id: WORKSPACE_A,
                channel_hub_account_id: ACCOUNT_B,
            }),
            /unique|constraint/i
        );
    });
});
