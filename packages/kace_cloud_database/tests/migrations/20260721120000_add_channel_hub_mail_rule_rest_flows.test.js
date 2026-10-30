import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';
import { postgresConnection } from '../../utils/postgresTestConnection.js';

import { up, down } from '../../migrations/20260721120000_add_channel_hub_mail_rule_rest_flows.js';

const TABLE = 'channel_hub_accounts';
const LIST_COLUMN = 'mail_rule_list_rest_flow_id';
const UPDATE_COLUMN = 'mail_rule_priority_update_rest_flow_id';
const FLOW_ID = '11111111-1111-4111-8111-111111111111';
const MISSING_FLOW_ID = '22222222-2222-4222-8222-222222222222';

async function withPostgresSchema(run) {
    const schema = `tmp_mail_rule_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const admin = knexLib({ client: 'pg', connection: postgresConnection() });
    await admin.raw('create schema ??', [schema]);
    const db = knexLib({ client: 'pg', connection: postgresConnection(), searchPath: [schema] });

    try {
        await db.schema.createTable('ws_rest_flows', (table) => table.string('id', 36).primary());
        await db.schema.createTable(TABLE, (table) => table.string('id', 36).primary());
        await db('ws_rest_flows').insert({ id: FLOW_ID });
        await run(db, schema);
    } finally {
        await db.destroy();
        await admin.raw('drop schema ?? cascade', [schema]);
        await admin.destroy();
    }
}

async function tableColumns(db, schema) {
    return db('information_schema.columns').where({ table_schema: schema, table_name: TABLE }).pluck('column_name');
}

test('up adds nullable Channel Hub mail-rule RestFlow references', async () => {
    await withPostgresSchema(async (db, schema) => {
        await up(db);

        await db(TABLE).insert([
            { id: '33333333-3333-4333-8333-333333333333' },
            {
                id: '44444444-4444-4444-8444-444444444444',
                [LIST_COLUMN]: FLOW_ID,
                [UPDATE_COLUMN]: FLOW_ID,
            },
        ]);

        const columns = await tableColumns(db, schema);
        assert.equal(columns.includes(LIST_COLUMN), true);
        assert.equal(columns.includes(UPDATE_COLUMN), true);

        const nullable = await db(TABLE).where({ id: '33333333-3333-4333-8333-333333333333' }).first();
        assert.equal(nullable[LIST_COLUMN], null);
        assert.equal(nullable[UPDATE_COLUMN], null);

        await assert.rejects(
            db(TABLE).insert({
                id: '55555555-5555-4555-8555-555555555555',
                [LIST_COLUMN]: MISSING_FLOW_ID,
            }),
            /violates foreign key constraint/i
        );
    });
});

test('down removes both Channel Hub mail-rule RestFlow references', async () => {
    await withPostgresSchema(async (db, schema) => {
        await up(db);
        await down(db);

        const columns = await tableColumns(db, schema);
        assert.equal(columns.includes(LIST_COLUMN), false);
        assert.equal(columns.includes(UPDATE_COLUMN), false);
    });
});
