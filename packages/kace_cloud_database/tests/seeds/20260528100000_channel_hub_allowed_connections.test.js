import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexFactory from 'knex';

import { CHANNEL_HUB_ALLOWED_CONNECTIONS, seed } from '../../seeds/20260528100000_channel_hub_allowed_connections.js';

async function withDatabase(callback) {
    const db = knexFactory({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
    });

    try {
        await db.schema.createTable('allowed_connections', (table) => {
            table.string('id', 36).primary();
            table.string('description', 255);
            table.string('connection', 255);
            table.text('certificate');
            table.boolean('is_active');
            table.timestamp('created_at');
            table.string('created_by', 36);
            table.timestamp('updated_at');
            table.string('updated_by', 36);
            table.timestamp('deleted_at');
            table.string('deleted_by', 36);
            table.boolean('has_ssl').notNullable().defaultTo(false);
        });

        await callback(db);
    } finally {
        await db.destroy();
    }
}

test('Channel Hub allowed connection seed inserts OAuth and CloudFront fingerprints', async () => {
    await withDatabase(async (db) => {
        await seed(db);

        const rows = await db('allowed_connections').orderBy('connection');

        assert.deepEqual(
            rows.map(({ connection, description, certificate, is_active, has_ssl }) => ({
                connection,
                description,
                certificate,
                is_active: Boolean(is_active),
                has_ssl: Boolean(has_ssl),
            })),
            [
                {
                    connection: 'ch-tst.auth.eu-west-1.amazoncognito.com',
                    description: 'ChannelHubOauth',
                    certificate: '55b6acc270e5addb1abd1a6e0f8502787576d79ca137821bd638198ee8b5a1b6',
                    is_active: true,
                    has_ssl: true,
                },
                {
                    connection: 'd13sfafwp8nvyq.cloudfront.net',
                    description: 'ChannelHub Cloudfront',
                    certificate: 'c6c6d5c7f79211bbd598b6eb4302e5657be832e775cee0a829b0dea35eaf4e02',
                    is_active: true,
                    has_ssl: true,
                },
            ]
        );
    });
});

test('Channel Hub allowed connection seed updates existing rows by connection instead of duplicating them', async () => {
    await withDatabase(async (db) => {
        await db('allowed_connections').insert({
            id: 'existing-oauth-id',
            connection: CHANNEL_HUB_ALLOWED_CONNECTIONS[0].connection,
            description: 'stale',
            certificate: 'stale',
            is_active: false,
            has_ssl: false,
            created_at: '2026-05-01 00:00:00 -05:00',
            created_by: 'old-user-id',
            updated_at: '2026-05-01 00:00:00 -05:00',
            updated_by: 'old-user-id',
            deleted_at: null,
            deleted_by: null,
        });

        await seed(db);
        await seed(db);

        const rows = await db('allowed_connections').where({
            connection: CHANNEL_HUB_ALLOWED_CONNECTIONS[0].connection,
        });

        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, 'existing-oauth-id');
        assert.equal(rows[0].description, 'ChannelHubOauth');
        assert.equal(rows[0].certificate, '55b6acc270e5addb1abd1a6e0f8502787576d79ca137821bd638198ee8b5a1b6');
        assert.equal(Boolean(rows[0].is_active), true);
        assert.equal(Boolean(rows[0].has_ssl), true);
    });
});
