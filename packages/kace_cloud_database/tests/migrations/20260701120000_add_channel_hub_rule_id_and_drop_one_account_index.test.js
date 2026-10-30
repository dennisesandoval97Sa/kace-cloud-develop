import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import { ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX } from '../../migrations/20260522200000_enforce_one_channel_hub_account_per_workspace.js';
import {
    CHANNEL_HUB_RULE_ID_COLUMN,
    up,
    down,
} from '../../migrations/20260701120000_add_channel_hub_rule_id_and_drop_one_account_index.js';

const RELATIONS_TABLE = 'workspaces_channel_hub_accounts_relations';
const WORKSPACE_A = 'workspace-a';
const ACCOUNT_A = 'account-a';
const ACCOUNT_B = 'account-b';

async function createSchemaWithIndex(db) {
    await db.schema.createTable('workspaces', (table) => {
        table.string('id', 36).primary();
    });
    await db.schema.createTable('channel_hub_accounts', (table) => {
        table.string('id', 36).primary();
    });
    await db.schema.createTable(RELATIONS_TABLE, (table) => {
        table.string('workspace_id', 36).notNullable();
        table.string('channel_hub_account_id', 36).notNullable();
        table.primary(['workspace_id', 'channel_hub_account_id']);
    });
    // Simulate the state left by migration 20260522200000: the one-account-per-workspace unique index.
    await db.raw(
        `create unique index if not exists ${ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX} on ${RELATIONS_TABLE} (workspace_id)`
    );
}

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await createSchemaWithIndex(db);
        await db('workspaces').insert([{ id: WORKSPACE_A }]);
        await db('channel_hub_accounts').insert([{ id: ACCOUNT_A }, { id: ACCOUNT_B }]);
        await fn(db);
    } finally {
        await db.destroy();
    }
}

async function indexExists(db) {
    const indexes = await db.raw(`PRAGMA index_list('${RELATIONS_TABLE}')`);
    return indexes.some((index) => index.name === ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX);
}

async function columnExists(db, column) {
    const columns = await db.raw(`PRAGMA table_info('${RELATIONS_TABLE}')`);
    return columns.some((c) => c.name === column);
}

test('up drops the one-account-per-workspace index and allows several accounts per workspace', async () => {
    await withDatabase(async (db) => {
        await up(db);

        assert.equal(await indexExists(db), false);

        await db(RELATIONS_TABLE).insert([
            { workspace_id: WORKSPACE_A, channel_hub_account_id: ACCOUNT_A },
            { workspace_id: WORKSPACE_A, channel_hub_account_id: ACCOUNT_B },
        ]);

        const rows = await db(RELATIONS_TABLE).where({ workspace_id: WORKSPACE_A });
        assert.equal(rows.length, 2);
    });
});

test('up adds a nullable channel_hub_rule_id column that stores a rule id per account', async () => {
    await withDatabase(async (db) => {
        await up(db);

        assert.equal(await columnExists(db, CHANNEL_HUB_RULE_ID_COLUMN), true);

        // Nullable: a relation without a rule id (pending registration) is allowed.
        await db(RELATIONS_TABLE).insert({ workspace_id: WORKSPACE_A, channel_hub_account_id: ACCOUNT_A });
        // And a rule id can be stored per account.
        await db(RELATIONS_TABLE).insert({
            workspace_id: WORKSPACE_A,
            channel_hub_account_id: ACCOUNT_B,
            [CHANNEL_HUB_RULE_ID_COLUMN]: 'rule-123',
        });

        const rows = await db(RELATIONS_TABLE).where({ workspace_id: WORKSPACE_A }).orderBy('channel_hub_account_id');
        assert.equal(rows[0][CHANNEL_HUB_RULE_ID_COLUMN], null);
        assert.equal(rows[1][CHANNEL_HUB_RULE_ID_COLUMN], 'rule-123');
    });
});

test('down drops the channel_hub_rule_id column without recreating the one-account index', async () => {
    await withDatabase(async (db) => {
        await up(db);

        // Multi-account data may already exist; recreating the unique index would fail on it,
        // so down() must not restore it (rollback-all in test harnesses runs with data present).
        await db(RELATIONS_TABLE).insert([
            { workspace_id: WORKSPACE_A, channel_hub_account_id: ACCOUNT_A },
            { workspace_id: WORKSPACE_A, channel_hub_account_id: ACCOUNT_B },
        ]);

        await down(db);

        assert.equal(await columnExists(db, CHANNEL_HUB_RULE_ID_COLUMN), false);
        assert.equal(await indexExists(db), false);

        const rows = await db(RELATIONS_TABLE).where({ workspace_id: WORKSPACE_A });
        assert.equal(rows.length, 2);
    });
});
