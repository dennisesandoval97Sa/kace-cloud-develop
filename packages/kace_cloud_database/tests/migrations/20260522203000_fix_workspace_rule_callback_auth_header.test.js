import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import {
    WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
    buildWorkspaceRuleCallbackEndpointRow,
} from '../../migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.js';
import { up, down } from '../../migrations/20260522203000_fix_workspace_rule_callback_auth_header.js';

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await db.schema.createTable('ws_rest_endpoints', (table) => {
            table.string('id', 36).primary();
            table.text('headers');
        });
        await fn(db);
    } finally {
        await db.destroy();
    }
}

test('up fixes Workspace rule callback Authorization and fingerprint headers', async () => {
    await withDatabase(async (db) => {
        const endpoint = buildWorkspaceRuleCallbackEndpointRow();
        const headers = JSON.parse(endpoint.headers);
        headers.headers.Authorization = 'Bearer context.kace.auth.id_token';

        await db('ws_rest_endpoints').insert({
            id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
            headers: JSON.stringify(headers),
        });

        await up(db);

        const updated = await db('ws_rest_endpoints').where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).first();
        assert.deepEqual(JSON.parse(updated.headers), {
            headers: {
                Authorization: 'context.kace.auth.id_token',
                'X-Client-Fingerprint': 'kace-restflow-callback',
                'X-Tenant-ID': 'context.tenant_id',
            },
        });
    });
});

test('down restores the previous Bearer-prefixed callback Authorization header', async () => {
    await withDatabase(async (db) => {
        await db('ws_rest_endpoints').insert({
            id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
            headers: JSON.stringify({
                headers: {
                    Authorization: 'context.kace.auth.id_token',
                    'X-Tenant-ID': 'context.tenant_id',
                },
            }),
        });

        await down(db);

        const updated = await db('ws_rest_endpoints').where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).first();
        const headers = JSON.parse(updated.headers).headers;
        assert.equal(headers.Authorization, 'Bearer context.kace.auth.id_token');
        assert.equal(headers['X-Client-Fingerprint'], undefined);
    });
});
