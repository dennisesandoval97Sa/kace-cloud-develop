import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';
import { postgresConnection } from '../../utils/postgresTestConnection.js';

import {
    ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_INDEX,
    CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE,
    down as downBase,
    up as upBase,
} from '../../migrations/20260807120000_create_channel_hub_workspace_priority_reorders.js';
import {
    CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_LEASE_INDEX,
    CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_DUE_INDEX,
    CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_TABLE,
    down as downDurability,
    up as upDurability,
} from '../../migrations/20260825120000_add_channel_hub_workspace_priority_reorder_durability.js';

const withPostgresSchema = async (run) => {
    const schema = `tmp_priority_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const admin = knexLib({
        client: 'pg',
        connection: postgresConnection(),
    });
    await admin.raw('create schema ??', [schema]);
    const db = knexLib({
        client: 'pg',
        connection: postgresConnection(),
        searchPath: [schema],
    });
    try {
        await db.schema.createTable('channel_hub_accounts', (table) => table.string('id', 36).primary());
        await run(db, schema);
    } finally {
        await db.destroy();
        await admin.raw('drop schema ?? cascade', [schema]);
        await admin.destroy();
    }
};

test('upgrades an already-created reorder table with leases, outbox claims, and supporting indexes', async () => {
    await withPostgresSchema(async (db, schema) => {
        await upBase(db);
        await db('channel_hub_accounts').insert({ id: '11111111-1111-4111-8111-111111111111' });
        await db(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE).insert({
            id: '22222222-2222-4222-8222-222222222222',
            channel_hub_account_id: '11111111-1111-4111-8111-111111111111',
            revision: 'revision-before-upgrade',
            ordered_workspace_ids: JSON.stringify(['workspace-a']),
            status: 'in_progress',
            attempt_count: 1,
            started_at: new Date('2026-01-01T00:00:00.000Z'),
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
        });
        await upDurability(db);

        const operationColumns = await db('information_schema.columns')
            .where({ table_schema: schema, table_name: CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE })
            .pluck('column_name');
        assert.ok(operationColumns.includes('lease_owner_id'));
        assert.ok(operationColumns.includes('heartbeat_at'));
        assert.ok(operationColumns.includes('lease_expires_at'));
        assert.ok(operationColumns.includes('validated_at'));

        const upgradedOperation = await db(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE)
            .where({ id: '22222222-2222-4222-8222-222222222222' })
            .first();
        assert.ok(upgradedOperation.validated_at);
        assert.ok(upgradedOperation.lease_expires_at <= new Date());
        const takeover = await db(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE)
            .where({ id: upgradedOperation.id, status: 'in_progress' })
            .where('lease_expires_at', '<=', new Date())
            .update({
                lease_owner_id: '33333333-3333-4333-8333-333333333333',
                lease_expires_at: new Date(Date.now() + 60_000),
            })
            .returning('lease_owner_id');
        assert.equal(takeover[0].lease_owner_id, '33333333-3333-4333-8333-333333333333');

        const outboxColumns = await db('information_schema.columns')
            .where({ table_schema: schema, table_name: CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_TABLE })
            .pluck('column_name');
        assert.ok(outboxColumns.includes('event'));
        assert.ok(outboxColumns.includes('claim_owner_id'));
        assert.ok(outboxColumns.includes('next_attempt_at'));

        const indexes = await db('pg_indexes').where({ schemaname: schema }).pluck('indexname');
        assert.ok(indexes.includes(ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_INDEX));
        assert.ok(indexes.includes(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_LEASE_INDEX));
        assert.ok(indexes.includes(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_DUE_INDEX));

        await downDurability(db);
        assert.equal(await db.schema.hasTable(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_OUTBOX_TABLE), false);
        const rolledBackColumns = await db('information_schema.columns')
            .where({ table_schema: schema, table_name: CHANNEL_HUB_WORKSPACE_PRIORITY_REORDERS_TABLE })
            .pluck('column_name');
        assert.equal(rolledBackColumns.includes('lease_owner_id'), false);
        await downBase(db);
    });
});
