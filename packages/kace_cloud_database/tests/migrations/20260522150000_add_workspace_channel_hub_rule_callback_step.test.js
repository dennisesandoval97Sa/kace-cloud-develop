import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import {
    CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
    KACE_API_ALLOWED_CONNECTION_ID,
    KACE_TENANT_API_ALLOWED_CONNECTION_ID,
    KACE_SERVICE_AUTH_ENDPOINT_ID,
    WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
    buildKaceApiAllowedConnectionRow,
    buildKaceApiAllowedConnectionRows,
    buildKaceServiceAuthEndpointRow,
    buildWorkspaceRuleCallbackEndpointRow,
    up,
    down,
} from '../../migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.js';

const CREATE_TAG_ENDPOINT_ID = '5ac4c03c-f840-4fa4-aaea-60734b08a02f';
const CREATE_TAG_FLOW_ID = '87a4be75-21eb-4da4-85dc-71c7fd7de006';
const CREATE_TAG_STEP_ID = 'd1eeda01-e373-40a1-8fe2-50a7107dd0ba';
const SECOND_CREATE_TAG_ENDPOINT_ID = 'b6a884a1-52f5-483a-8792-7fdab9a72926';
const SECOND_CREATE_TAG_STEP_ID = '29f8c8ad-4f63-4648-a248-48146b096e4d';
const SECOND_STEP_ID = 'b25f4d4f-cf1f-4b89-8d9e-1d2cbbfcdd1a';

async function createSchema(db) {
    await db.schema.createTable('ws_rest_flows', (table) => {
        table.string('id', 36).primary();
        table.string('description');
        table.boolean('is_active');
        table.timestamp('deleted_at');
    });

    await db.schema.createTable('ws_rest_endpoints', (table) => {
        table.string('id', 36).primary();
        table.string('type');
        table.string('description');
        table.text('url');
        table.string('method');
        table.text('headers');
        table.text('body');
        table.boolean('is_dynamic_body');
        table.boolean('is_active');
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
        table.string('authorization_id', 36);
        table.boolean('is_dynamic_header');
        table.text('filter_input');
        table.text('context_position');
        table.text('on_success');
        table.text('on_error');
        table.integer('attempts');
        table.text('initial_context');
        table.text('body_type');
        table.text('cache_expires_in_path');
        table.integer('cache_default_ttl_seconds');
    });

    await db.schema.createTable('allowed_connections', (table) => {
        table.string('id', 36).primary();
        table.string('description', 255);
        table.string('connection', 255);
        table.text('certificate');
        table.boolean('is_active');
        table.boolean('has_ssl');
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });

    await db.schema.createTable('ws_rest_workflow_steps', (table) => {
        table.string('id', 36).primary();
        table.string('flow_id', 36);
        table.integer('order');
        table.string('endpoint_id', 36);
        table.string('function_id', 36);
        table.string('conditional_id', 36);
        table.string('parent_step_id', 36);
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });
}

async function seedFlow(db, { id = CREATE_TAG_FLOW_ID, isActive = true, deletedAt = null } = {}) {
    await db('ws_rest_flows').insert({
        id,
        description: 'Workspace register tags RestFlow',
        is_active: isActive,
        deleted_at: deletedAt,
    });
}

function buildCreateTagEndpointRow({ id = CREATE_TAG_ENDPOINT_ID, isActive = true, deletedAt = null } = {}) {
    return {
        id,
        type: 'consumption',
        description: 'Channel Hub - Crear Tag (email rule)',
        url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule',
        method: 'POST',
        headers: JSON.stringify({ headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' } }),
        body: JSON.stringify({ body: 'context.channel_hub_tag_request' }),
        is_dynamic_body: true,
        is_active: isActive,
        created_at: '2026-05-21 03:12:39.347 -05:00',
        created_by: 'e733cac1-001f-46fc-9ad4-b7ebffaca7d7',
        updated_at: '2026-05-21 08:29:11.814 -05:00',
        updated_by: 'e733cac1-001f-46fc-9ad4-b7ebffaca7d7',
        deleted_at: deletedAt,
        deleted_by: null,
        authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73',
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: [] }),
        context_position: 'channel_hub_tag.response',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
        body_type: 'json',
    };
}

async function seedCreateTagFlow(db) {
    await seedFlow(db);
    await db('ws_rest_endpoints').insert(buildCreateTagEndpointRow());

    await db('ws_rest_workflow_steps').insert([
        {
            id: CREATE_TAG_STEP_ID,
            flow_id: CREATE_TAG_FLOW_ID,
            order: 2,
            endpoint_id: CREATE_TAG_ENDPOINT_ID,
            function_id: null,
            conditional_id: null,
            parent_step_id: null,
            created_at: '2026-05-22 12:00:00 -05:00',
            created_by: '7d15692d-5bf4-4135-8096-06e7b1098b54',
        },
        {
            id: SECOND_STEP_ID,
            flow_id: CREATE_TAG_FLOW_ID,
            order: 3,
            endpoint_id: null,
            function_id: 'b21e3fb8-63e4-4ca0-91a0-1e58908bfa2f',
            conditional_id: null,
            parent_step_id: null,
            created_at: '2026-05-22 12:00:00 -05:00',
            created_by: '7d15692d-5bf4-4135-8096-06e7b1098b54',
        },
    ]);
}

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await createSchema(db);
        await fn(db);
    } finally {
        await db.destroy();
    }
}

async function withEnv(overrides, fn) {
    const previousValues = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));

    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        await fn();
    } finally {
        for (const [key, value] of Object.entries(previousValues)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test('builder rows define KACE service auth, allowed connection, and Workspace callback endpoint', () => {
    const allowedConnection = buildKaceApiAllowedConnectionRow('2026-05-22 15:00:00 -05:00');
    const allowedConnections = buildKaceApiAllowedConnectionRows({
        createdAt: '2026-05-22 15:00:00 -05:00',
        env: {
            APPS_EXECUTE_REST_HOOK_SERVICE_URL: 'https://correos-api.kace-cloudtest.com',
        },
    });
    const auth = buildKaceServiceAuthEndpointRow('2026-05-22 15:00:00 -05:00');
    const callback = buildWorkspaceRuleCallbackEndpointRow('2026-05-22 15:00:00 -05:00');

    assert.equal(allowedConnection.id, KACE_API_ALLOWED_CONNECTION_ID);
    assert.equal(allowedConnection.description, 'KACE Cloud API');
    assert.equal(allowedConnection.connection, 'api.konecta.cloud');
    assert.equal(allowedConnection.is_active, true);
    assert.equal(allowedConnection.has_ssl, false);
    assert.deepEqual(
        allowedConnections.map(({ id, connection }) => ({ id, connection })),
        [
            { id: KACE_API_ALLOWED_CONNECTION_ID, connection: 'api.konecta.cloud' },
            { id: KACE_TENANT_API_ALLOWED_CONNECTION_ID, connection: 'correos-api.kace-cloudtest.com' },
        ]
    );

    assert.equal(auth.id, KACE_SERVICE_AUTH_ENDPOINT_ID);
    assert.equal(auth.description, 'KACE Cloud - RestFlow service account auth');
    assert.equal(auth.url, 'context.kace_api_base_url/auth-cognito');
    assert.deepEqual(JSON.parse(auth.headers), {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Fingerprint': 'kace-restflow-callback',
            'X-Tenant-ID': 'context.tenant_id',
        },
    });
    assert.deepEqual(JSON.parse(auth.body), {
        body: {
            username: 'SECRET_KACE_RESTFLOW_CALLBACK_USERNAME',
            password: 'SECRET_KACE_RESTFLOW_CALLBACK_PASSWORD',
        },
    });
    assert.deepEqual(JSON.parse(auth.filter_input), { filter_input: ['data.id_token'] });
    assert.equal(auth.context_position, 'kace.auth');

    assert.equal(callback.id, WORKSPACE_RULE_CALLBACK_ENDPOINT_ID);
    assert.equal(callback.description, 'Workspace - Persist Channel Hub Rule Id');
    assert.equal(
        callback.url,
        'context.kace_api_base_url/workspaces/context.workspace.id/channel-hub-tags/rule-created'
    );
    assert.equal(callback.method, 'POST');
    assert.equal(callback.authorization_id, KACE_SERVICE_AUTH_ENDPOINT_ID);
    assert.deepEqual(JSON.parse(callback.headers), {
        headers: {
            Authorization: 'context.kace.auth.id_token',
            'X-Client-Fingerprint': 'kace-restflow-callback',
            'X-Tenant-ID': 'context.tenant_id',
        },
    });
    assert.deepEqual(JSON.parse(callback.body), {
        body: {
            channel_hub_account_id: 'context.workspace.channel_hub_accounts[0].id',
            connection_id: 'context.channel_hub_tag.response.connectionId',
            rule_id: 'context.channel_hub_tag.response.id',
        },
    });
    assert.equal(callback.context_position, 'workspace.channel_hub_tag_rule_created');
    assert.deepEqual(JSON.parse(callback.on_error), {
        on_error: {
            400: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            401: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            403: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            404: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            405: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            408: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            409: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            422: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            429: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            500: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            502: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            503: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            504: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
        },
    });
});

test('up inserts callback endpoint and step after active create-tag POST endpoint', async () => {
    await withEnv(
        {
            APPS_EXECUTE_REST_HOOK_SERVICE_URL: 'https://correos-api.kace-cloudtest.com',
            APPS_API_SUBDOMAIN: undefined,
            APPS_DOMAIN: undefined,
        },
        async () => {
            await withDatabase(async (db) => {
                await seedCreateTagFlow(db);

                await up(db);

                const allowedConnections = await db('allowed_connections').orderBy('id');
                assert.ok(allowedConnections.some((connection) => connection.id === KACE_API_ALLOWED_CONNECTION_ID));
                assert.ok(
                    allowedConnections.some((connection) => connection.id === KACE_TENANT_API_ALLOWED_CONNECTION_ID)
                );
                assert.ok(allowedConnections.some((connection) => connection.connection === 'api.konecta.cloud'));
                assert.ok(
                    allowedConnections.some((connection) => connection.connection === 'correos-api.kace-cloudtest.com')
                );

                const endpoints = await db('ws_rest_endpoints').orderBy('id');
                assert.ok(endpoints.some((endpoint) => endpoint.id === KACE_SERVICE_AUTH_ENDPOINT_ID));
                assert.ok(endpoints.some((endpoint) => endpoint.id === WORKSPACE_RULE_CALLBACK_ENDPOINT_ID));

                const steps = await db('ws_rest_workflow_steps')
                    .where({ flow_id: CREATE_TAG_FLOW_ID })
                    .orderBy('order');
                assert.equal(steps.length, 3);
                assert.equal(steps[0].id, CREATE_TAG_STEP_ID);
                assert.equal(steps[0].order, 2);
                assert.equal(steps[1].endpoint_id, WORKSPACE_RULE_CALLBACK_ENDPOINT_ID);
                assert.equal(steps[1].order, 3);
                assert.equal(steps[1].parent_step_id, CREATE_TAG_STEP_ID);
                assert.equal(steps[2].id, SECOND_STEP_ID);
                assert.equal(steps[2].order, 4);
            });
        }
    );
});

test('up inserts one callback step per create-tag POST step in the same active flow', async () => {
    await withDatabase(async (db) => {
        await seedFlow(db);
        await db('ws_rest_endpoints').insert([
            buildCreateTagEndpointRow(),
            buildCreateTagEndpointRow({ id: SECOND_CREATE_TAG_ENDPOINT_ID }),
        ]);
        await db('ws_rest_workflow_steps').insert([
            {
                id: CREATE_TAG_STEP_ID,
                flow_id: CREATE_TAG_FLOW_ID,
                order: 2,
                endpoint_id: CREATE_TAG_ENDPOINT_ID,
            },
            {
                id: SECOND_CREATE_TAG_STEP_ID,
                flow_id: CREATE_TAG_FLOW_ID,
                order: 3,
                endpoint_id: SECOND_CREATE_TAG_ENDPOINT_ID,
            },
            {
                id: SECOND_STEP_ID,
                flow_id: CREATE_TAG_FLOW_ID,
                order: 4,
                function_id: 'b21e3fb8-63e4-4ca0-91a0-1e58908bfa2f',
            },
        ]);

        await up(db);

        const steps = await db('ws_rest_workflow_steps').where({ flow_id: CREATE_TAG_FLOW_ID }).orderBy('order');
        assert.equal(steps.length, 5);
        assert.deepEqual(
            steps.map((step) => ({
                id: step.id,
                endpoint_id: step.endpoint_id,
                parent_step_id: step.parent_step_id,
                order: step.order,
            })),
            [
                { id: CREATE_TAG_STEP_ID, endpoint_id: CREATE_TAG_ENDPOINT_ID, parent_step_id: null, order: 2 },
                {
                    id: steps[1].id,
                    endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
                    parent_step_id: CREATE_TAG_STEP_ID,
                    order: 3,
                },
                {
                    id: SECOND_CREATE_TAG_STEP_ID,
                    endpoint_id: SECOND_CREATE_TAG_ENDPOINT_ID,
                    parent_step_id: null,
                    order: 4,
                },
                {
                    id: steps[3].id,
                    endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
                    parent_step_id: SECOND_CREATE_TAG_STEP_ID,
                    order: 5,
                },
                { id: SECOND_STEP_ID, endpoint_id: null, parent_step_id: null, order: 6 },
            ]
        );

        await up(db);

        const callbackSteps = await db('ws_rest_workflow_steps')
            .where({ flow_id: CREATE_TAG_FLOW_ID, endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID })
            .whereNull('deleted_at')
            .orderBy('order');
        assert.deepEqual(
            callbackSteps.map((step) => step.parent_step_id),
            [CREATE_TAG_STEP_ID, SECOND_CREATE_TAG_STEP_ID]
        );
    });
});

test('up ignores inactive create-tag endpoints and inactive flows', async () => {
    await withDatabase(async (db) => {
        await db('ws_rest_flows').insert([
            { id: 'active-flow-id', description: 'active', is_active: true, deleted_at: null },
            { id: 'inactive-flow-id', description: 'inactive', is_active: false, deleted_at: null },
        ]);
        await db('ws_rest_endpoints').insert([
            buildCreateTagEndpointRow({ id: 'active-endpoint-id' }),
            buildCreateTagEndpointRow({ id: 'inactive-endpoint-id', isActive: false }),
            buildCreateTagEndpointRow({ id: 'inactive-flow-endpoint-id' }),
        ]);
        await db('ws_rest_workflow_steps').insert([
            {
                id: 'active-create-step-id',
                flow_id: 'active-flow-id',
                order: 1,
                endpoint_id: 'active-endpoint-id',
            },
            {
                id: 'inactive-endpoint-step-id',
                flow_id: 'active-flow-id',
                order: 2,
                endpoint_id: 'inactive-endpoint-id',
            },
            {
                id: 'inactive-flow-step-id',
                flow_id: 'inactive-flow-id',
                order: 1,
                endpoint_id: 'inactive-flow-endpoint-id',
            },
        ]);

        await up(db);

        const callbackSteps = await db('ws_rest_workflow_steps')
            .where({ endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID })
            .orderBy('parent_step_id');
        assert.deepEqual(
            callbackSteps.map((step) => step.parent_step_id),
            ['active-create-step-id']
        );
    });
});

test('up ignores deleted create-tag endpoints and deleted flows', async () => {
    await withDatabase(async (db) => {
        await db('ws_rest_flows').insert([
            { id: 'active-flow-id', description: 'active', is_active: true, deleted_at: null },
            {
                id: 'deleted-flow-id',
                description: 'deleted',
                is_active: true,
                deleted_at: '2026-05-22 16:00:00 -05:00',
            },
        ]);
        await db('ws_rest_endpoints').insert([
            buildCreateTagEndpointRow({ id: 'active-endpoint-id' }),
            buildCreateTagEndpointRow({
                id: 'deleted-endpoint-id',
                deletedAt: '2026-05-22 16:00:00 -05:00',
            }),
            buildCreateTagEndpointRow({ id: 'deleted-flow-endpoint-id' }),
        ]);
        await db('ws_rest_workflow_steps').insert([
            {
                id: 'active-create-step-id',
                flow_id: 'active-flow-id',
                order: 1,
                endpoint_id: 'active-endpoint-id',
            },
            {
                id: 'deleted-endpoint-step-id',
                flow_id: 'active-flow-id',
                order: 2,
                endpoint_id: 'deleted-endpoint-id',
            },
            {
                id: 'deleted-flow-step-id',
                flow_id: 'deleted-flow-id',
                order: 1,
                endpoint_id: 'deleted-flow-endpoint-id',
            },
        ]);

        await up(db);

        const callbackSteps = await db('ws_rest_workflow_steps')
            .where({ endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID })
            .orderBy('parent_step_id');
        assert.deepEqual(
            callbackSteps.map((step) => step.parent_step_id),
            ['active-create-step-id']
        );
    });
});

test('up reuses an existing active allowed connection by domain instead of inserting owned id', async () => {
    await withDatabase(async (db) => {
        await seedCreateTagFlow(db);
        await db('allowed_connections').insert({
            id: 'existing-api-domain-id',
            description: 'stale description',
            connection: 'api.konecta.cloud',
            certificate: null,
            is_active: false,
            has_ssl: true,
            created_at: '2026-05-01 00:00:00 -05:00',
            created_by: 'old-user-id',
            updated_at: '2026-05-01 00:00:00 -05:00',
            updated_by: 'old-user-id',
            deleted_at: null,
            deleted_by: null,
        });

        await up(db);

        const allowedConnections = await db('allowed_connections').where({ connection: 'api.konecta.cloud' });
        assert.equal(allowedConnections.length, 1);
        assert.deepEqual(
            allowedConnections.map(({ id, description, is_active, has_ssl }) => ({
                id,
                description,
                is_active: Boolean(is_active),
                has_ssl: Boolean(has_ssl),
            })),
            [
                {
                    id: 'existing-api-domain-id',
                    description: 'KACE Cloud API',
                    is_active: true,
                    has_ssl: false,
                },
            ]
        );
    });
});

test('up is idempotent and does not duplicate callback steps', async () => {
    await withDatabase(async (db) => {
        await seedCreateTagFlow(db);

        await up(db);
        await up(db);

        const callbackSteps = await db('ws_rest_workflow_steps').where({
            flow_id: CREATE_TAG_FLOW_ID,
            endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
            parent_step_id: CREATE_TAG_STEP_ID,
        });
        assert.equal(callbackSteps.length, 1);
    });
});

test('down removes callback step and restores shifted workflow orders', async () => {
    await withDatabase(async (db) => {
        await seedCreateTagFlow(db);
        await up(db);

        await down(db);

        const allowedConnections = await db('allowed_connections').orderBy('id');
        assert.equal(
            allowedConnections.some((connection) => connection.id === KACE_API_ALLOWED_CONNECTION_ID),
            false
        );

        const endpoints = await db('ws_rest_endpoints').orderBy('id');
        assert.equal(
            endpoints.some((endpoint) => endpoint.id === WORKSPACE_RULE_CALLBACK_ENDPOINT_ID),
            false
        );
        assert.equal(
            endpoints.some((endpoint) => endpoint.id === KACE_SERVICE_AUTH_ENDPOINT_ID),
            false
        );

        const steps = await db('ws_rest_workflow_steps').where({ flow_id: CREATE_TAG_FLOW_ID }).orderBy('order');
        assert.deepEqual(
            steps.map((step) => ({ id: step.id, order: step.order })),
            [
                { id: CREATE_TAG_STEP_ID, order: 2 },
                { id: SECOND_STEP_ID, order: 3 },
            ]
        );
    });
});
