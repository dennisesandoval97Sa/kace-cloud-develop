import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import { up, down } from '../../migrations/20260525130000_add_thread_id_to_emails.js';

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

test('up adds nullable thread_id to emails and down removes it', async () => {
    await withDatabase(async (db) => {
        await up(db);

        const columnsAfterUp = await getColumnNames(db);
        assert.ok(columnsAfterUp.includes('thread_id'), 'thread_id should exist after up');

        await db('emails').insert({
            id: 'email-id',
            message_id: 'message-id',
        });

        const row = await db('emails').where({ id: 'email-id' }).first();
        assert.equal(row.thread_id, null);

        await down(db);

        const columnsAfterDown = await getColumnNames(db);
        assert.equal(columnsAfterDown.includes('thread_id'), false, 'thread_id should be removed after down');
    });
});
