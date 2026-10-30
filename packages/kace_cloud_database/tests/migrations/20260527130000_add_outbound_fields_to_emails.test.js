import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import { up, down } from '../../migrations/20260527130000_add_outbound_fields_to_emails.js';

async function createEmailsSchema(db) {
    await db.schema.createTable('emails', (table) => {
        table.string('id', 36).primary();
        table.string('message_id', 255);
    });
}

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await createEmailsSchema(db);
        await fn(db);
    } finally {
        await db.destroy();
    }
}

async function getColumnNames(db) {
    const columns = await db('emails').columnInfo();
    return Object.keys(columns);
}

test('up adds outbound fields to emails and down removes them', async () => {
    await withDatabase(async (db) => {
        await up(db);

        const columnsAfterUp = await getColumnNames(db);
        assert.ok(columnsAfterUp.includes('case_id_outbound'), 'case_id_outbound should exist after up');
        assert.ok(columnsAfterUp.includes('case_reference_outbound'), 'case_reference_outbound should exist after up');
        assert.ok(columnsAfterUp.includes('is_outbound'), 'is_outbound should exist after up');

        await db('emails').insert({
            id: 'email-id',
            message_id: 'message-id',
        });

        const row = await db('emails').where({ id: 'email-id' }).first();
        assert.equal(row.case_id_outbound, null);
        assert.equal(row.case_reference_outbound, null);
        assert.equal(row.is_outbound, 0);

        await db('emails').insert({
            id: 'email-outbound',
            message_id: 'message-outbound',
            case_id_outbound: '3e94fa34-4a9a-48c7-8024-38ed67a8507a',
            case_reference_outbound: 42,
            is_outbound: true,
        });

        const outboundRow = await db('emails').where({ id: 'email-outbound' }).first();
        assert.equal(outboundRow.case_id_outbound, '3e94fa34-4a9a-48c7-8024-38ed67a8507a');
        assert.equal(outboundRow.case_reference_outbound, 42);
        assert.equal(outboundRow.is_outbound, 1);

        await down(db);

        const columnsAfterDown = await getColumnNames(db);
        assert.equal(
            columnsAfterDown.includes('case_id_outbound'),
            false,
            'case_id_outbound should be removed after down'
        );
        assert.equal(
            columnsAfterDown.includes('case_reference_outbound'),
            false,
            'case_reference_outbound should be removed after down'
        );
        assert.equal(columnsAfterDown.includes('is_outbound'), false, 'is_outbound should be removed after down');
    });
});
