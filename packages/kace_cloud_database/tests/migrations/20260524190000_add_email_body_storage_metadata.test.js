import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import { up, down } from '../../migrations/20260524190000_add_email_body_storage_metadata.js';

const ADDED_COLUMNS = [
    'body_text_storage_mode',
    'body_text_s3_key',
    'body_text_size_bytes',
    'body_text_content_type',
    'body_text_sha256',
    'body_text_preview_truncated',
    'body_html_storage_mode',
    'body_html_s3_key',
    'body_html_size_bytes',
    'body_html_content_type',
    'body_html_sha256',
    'body_html_preview_truncated',
];

async function createEmailsBodySchema(db) {
    await db.schema.createTable('emails_body', (table) => {
        table.string('id', 36).primary();
        table.string('email_id', 36);
        table.text('body');
        table.text('body_html');
    });
}

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await createEmailsBodySchema(db);
        await fn(db);
    } finally {
        await db.destroy();
    }
}

async function getColumnNames(db) {
    const columns = await db('emails_body').columnInfo();
    return Object.keys(columns);
}

test('up adds email body storage metadata columns and down removes them', async () => {
    await withDatabase(async (db) => {
        await up(db);

        const columnsAfterUp = await getColumnNames(db);
        for (const column of ADDED_COLUMNS) {
            assert.ok(columnsAfterUp.includes(column), `${column} should exist after up`);
        }

        await db('emails_body').insert({
            id: 'body-id',
            email_id: 'email-id',
            body: 'legacy text body',
            body_html: '<p>legacy html body</p>',
        });

        const row = await db('emails_body').where({ id: 'body-id' }).first();
        assert.ok(
            row.body_text_preview_truncated === false || row.body_text_preview_truncated === 0,
            'body_text_preview_truncated should default to false'
        );
        assert.ok(
            row.body_html_preview_truncated === false || row.body_html_preview_truncated === 0,
            'body_html_preview_truncated should default to false'
        );

        await down(db);

        const columnsAfterDown = await getColumnNames(db);
        for (const column of ADDED_COLUMNS) {
            assert.equal(columnsAfterDown.includes(column), false, `${column} should be removed after down`);
        }
    });
});
