import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import {
    KACE_SERVICE_AUTH_ENDPOINT_ID,
    WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
    down,
    up,
} from '../../migrations/20260527170000_remove_workspace_channel_hub_rule_callback_step.js';

const FLOW_ID = '87a4be75-21eb-4da4-85dc-71c7fd7de006';
const OTHER_FLOW_ID = '395c59f0-ae18-4d06-9f7a-bcd0e1542c7d';
const EXISTING_ENDPOINT_ID = '5ac4c03c-f840-4fa4-aaea-60734b08a02f';
const SHARED_ENDPOINT_ID = 'f0d57d4f-c17b-4598-82f0-463651af716d';
const INACTIVE_SHARED_ENDPOINT_ID = 'c62b0f84-4334-4acf-a298-313a3bf784bb';
const DELETED_SHARED_ENDPOINT_ID = 'de59dc9f-bd15-4b4a-b8e1-70d699ab6d16';

async function createSchema(db) {
    await db.schema.createTable('ws_rest_endpoints', (table) => {
        table.string('id', 36).primary();
        table.string('type');
        table.string('description');
        table.text('url');
        table.string('method');
        table.boolean('is_active');
        table.timestamp('deleted_at');
        table.string('authorization_id', 36);
        table.foreign('authorization_id').references('id').inTable('ws_rest_endpoints');
    });

    await db.schema.createTable('ws_rest_workflow_steps', (table) => {
        table.string('id', 36).primary();
        table.string('flow_id', 36);
        table.integer('order');
        table.string('endpoint_id', 36);
        table.string('function_id', 36);
        table.timestamp('deleted_at');
        table.foreign('endpoint_id').references('id').inTable('ws_rest_endpoints');
    });
}

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await db.raw('PRAGMA foreign_keys = ON');
        await createSchema(db);
        await fn(db);
    } finally {
        await db.destroy();
    }
}

function endpointRow(overrides = {}) {
    return {
        id: EXISTING_ENDPOINT_ID,
        type: 'consumption',
        description: 'Existing endpoint',
        url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule',
        method: 'POST',
        is_active: true,
        deleted_at: null,
        authorization_id: null,
        ...overrides,
    };
}

function callbackEndpointRow() {
    return endpointRow({
        id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
        description: 'Workspace - Persist Channel Hub Rule Id',
        url: 'context.kace_api_base_url/workspaces/context.workspace.id/channel-hub-tags/rule-created',
        authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID,
    });
}

function authEndpointRow() {
    return endpointRow({
        id: KACE_SERVICE_AUTH_ENDPOINT_ID,
        type: 'authorization',
        description: 'KACE Cloud - RestFlow service account auth',
        url: 'context.kace_api_base_url/auth-cognito',
        authorization_id: null,
    });
}

async function seedCallbackFlow(db) {
    await db('ws_rest_endpoints').insert([authEndpointRow(), endpointRow(), callbackEndpointRow()]);
    await db('ws_rest_workflow_steps').insert([
        {
            id: 'create-tag-step-id',
            flow_id: FLOW_ID,
            order: 1,
            endpoint_id: EXISTING_ENDPOINT_ID,
            function_id: null,
            deleted_at: null,
        },
        {
            id: 'callback-step-id',
            flow_id: FLOW_ID,
            order: 2,
            endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
            function_id: null,
            deleted_at: null,
        },
        {
            id: 'after-callback-step-id',
            flow_id: FLOW_ID,
            order: 3,
            endpoint_id: null,
            function_id: 'b21e3fb8-63e4-4ca0-91a0-1e58908bfa2f',
            deleted_at: null,
        },
        {
            id: 'other-flow-callback-step-id',
            flow_id: OTHER_FLOW_ID,
            order: 1,
            endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
            function_id: null,
            deleted_at: null,
        },
        {
            id: 'other-flow-after-callback-step-id',
            flow_id: OTHER_FLOW_ID,
            order: 2,
            endpoint_id: null,
            function_id: 'cc1f1895-e4ff-4f3d-8ce1-bf0ab97a3d42',
            deleted_at: null,
        },
    ]);
}

test('up removes Workspace callback steps, compacts order, and removes callback endpoint', async () => {
    await withDatabase(async (db) => {
        await seedCallbackFlow(db);

        await up(db);

        const callbackSteps = await db('ws_rest_workflow_steps').where({
            endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
        });
        assert.equal(callbackSteps.length, 0);

        const flowSteps = await db('ws_rest_workflow_steps').where({ flow_id: FLOW_ID }).orderBy('order');
        assert.deepEqual(
            flowSteps.map((step) => ({ id: step.id, order: step.order })),
            [
                { id: 'create-tag-step-id', order: 1 },
                { id: 'after-callback-step-id', order: 2 },
            ]
        );

        const otherFlowSteps = await db('ws_rest_workflow_steps').where({ flow_id: OTHER_FLOW_ID }).orderBy('order');
        assert.deepEqual(
            otherFlowSteps.map((step) => ({ id: step.id, order: step.order })),
            [{ id: 'other-flow-after-callback-step-id', order: 1 }]
        );

        assert.equal(
            await db('ws_rest_endpoints').where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).first(),
            undefined
        );
        assert.equal(await db('ws_rest_endpoints').where({ id: KACE_SERVICE_AUTH_ENDPOINT_ID }).first(), undefined);
    });
});

test('up is idempotent when callback rows are already gone', async () => {
    await withDatabase(async (db) => {
        await db('ws_rest_endpoints').insert([authEndpointRow(), endpointRow()]);
        await db('ws_rest_workflow_steps').insert([
            {
                id: 'create-tag-step-id',
                flow_id: FLOW_ID,
                order: 1,
                endpoint_id: EXISTING_ENDPOINT_ID,
                function_id: null,
                deleted_at: null,
            },
        ]);

        await up(db);
        await up(db);

        const steps = await db('ws_rest_workflow_steps').where({ flow_id: FLOW_ID });
        assert.deepEqual(
            steps.map((step) => ({ id: step.id, order: step.order })),
            [{ id: 'create-tag-step-id', order: 1 }]
        );
        assert.equal(
            await db('ws_rest_endpoints').where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).first(),
            undefined
        );
    });
});

test('up removes soft-deleted callback steps so FK constraints do not block callback endpoint cleanup', async () => {
    await withDatabase(async (db) => {
        await seedCallbackFlow(db);
        await db('ws_rest_workflow_steps').insert({
            id: 'soft-deleted-callback-step-id',
            flow_id: FLOW_ID,
            order: 99,
            endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
            function_id: null,
            deleted_at: '2026-05-26 12:00:00 -05:00',
        });

        await up(db);

        assert.equal(
            await db('ws_rest_endpoints').where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).first(),
            undefined
        );
        const callbackSteps = await db('ws_rest_workflow_steps').where({
            endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
        });
        assert.equal(callbackSteps.length, 0);
    });
});

test('up keeps shared auth endpoint when another active endpoint still references it', async () => {
    await withDatabase(async (db) => {
        await seedCallbackFlow(db);
        await db('ws_rest_endpoints').insert(
            endpointRow({
                id: SHARED_ENDPOINT_ID,
                description: 'Shared KACE service consumer',
                authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID,
            })
        );

        await up(db);

        assert.equal(
            await db('ws_rest_endpoints').where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).first(),
            undefined
        );
        const authEndpoint = await db('ws_rest_endpoints').where({ id: KACE_SERVICE_AUTH_ENDPOINT_ID }).first();
        assert.equal(authEndpoint.id, KACE_SERVICE_AUTH_ENDPOINT_ID);
    });
});

test('up keeps shared auth endpoint when inactive or soft-deleted endpoints still reference it', async () => {
    await withDatabase(async (db) => {
        await seedCallbackFlow(db);
        await db('ws_rest_endpoints').insert([
            endpointRow({
                id: INACTIVE_SHARED_ENDPOINT_ID,
                description: 'Inactive shared KACE service consumer',
                is_active: false,
                authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID,
            }),
            endpointRow({
                id: DELETED_SHARED_ENDPOINT_ID,
                description: 'Soft-deleted shared KACE service consumer',
                deleted_at: '2026-05-26 12:00:00 -05:00',
                authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID,
            }),
        ]);

        await up(db);

        assert.equal(
            await db('ws_rest_endpoints').where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).first(),
            undefined
        );
        const authEndpoint = await db('ws_rest_endpoints').where({ id: KACE_SERVICE_AUTH_ENDPOINT_ID }).first();
        assert.equal(authEndpoint.id, KACE_SERVICE_AUTH_ENDPOINT_ID);
    });
});

test('down leaves the current no-callback design untouched', async () => {
    await withDatabase(async (db) => {
        await db('ws_rest_endpoints').insert([
            authEndpointRow(),
            endpointRow(),
            endpointRow({
                id: SHARED_ENDPOINT_ID,
                description: 'Shared KACE service consumer',
                authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID,
            }),
        ]);
        await db('ws_rest_workflow_steps').insert([
            {
                id: 'create-tag-step-id',
                flow_id: FLOW_ID,
                order: 1,
                endpoint_id: EXISTING_ENDPOINT_ID,
                function_id: null,
                deleted_at: null,
            },
            {
                id: 'after-create-step-id',
                flow_id: FLOW_ID,
                order: 2,
                endpoint_id: null,
                function_id: 'b21e3fb8-63e4-4ca0-91a0-1e58908bfa2f',
                deleted_at: null,
            },
        ]);
        const endpointsBefore = await db('ws_rest_endpoints').orderBy('id');
        const stepsBefore = await db('ws_rest_workflow_steps').orderBy('order');

        await down(db);

        assert.deepEqual(await db('ws_rest_endpoints').orderBy('id'), endpointsBefore);
        assert.deepEqual(await db('ws_rest_workflow_steps').orderBy('order'), stepsBefore);
    });
});
