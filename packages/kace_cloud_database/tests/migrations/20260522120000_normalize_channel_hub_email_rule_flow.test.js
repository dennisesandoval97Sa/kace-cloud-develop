import { test } from 'node:test';
import assert from 'node:assert/strict';

import knex from 'knex';

import {
    CHANNEL_HUB_TAG_REQUEST_CONTEXT_PATH,
    NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID,
    buildNormalizerFunctionRow,
    buildNormalizerStepRow,
    normalizeCreateTagEndpointBody,
    restoreCompactChannelHubTagBody,
    shouldInsertNormalizerStep,
    down,
    up,
} from '../../migrations/20260522120000_normalize_channel_hub_email_rule_flow.js';

const FLOW_ID = 'flow-id';
const ENDPOINT_ID = 'endpoint-id';
const ENDPOINT_STEP_ID = 'endpoint-step-id';
const AFTER_STEP_ID = 'after-step-id';

const createTestDatabase = async () => {
    const db = knex({
        client: 'sqlite3',
        connection: {
            filename: ':memory:',
        },
        useNullAsDefault: true,
    });

    await db.schema.createTable('ws_rest_endpoints', (table) => {
        table.string('id', 36).primary();
        table.string('url', 1000);
        table.text('body');
        table.timestamp('deleted_at');
    });

    await db.schema.createTable('ws_rest_functions', (table) => {
        table.string('id', 36).primary();
        table.string('description', 255);
        table.string('type', 255);
        table.jsonb('filter_input');
        table.text('context_position');
        table.boolean('value_dynamic');
        table.text('value_static');
        table.boolean('is_active');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
    });

    await db.schema.createTable('ws_rest_workflow_steps', (table) => {
        table.string('id', 36).primary();
        table.string('flow_id', 36);
        table.integer('order');
        table.string('endpoint_id', 36).nullable();
        table.string('function_id', 36).nullable();
        table.string('parent_step_id', 36).nullable();
        table.string('conditional_id', 36).nullable();
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });

    return db;
};

const insertChannelHubEndpointFlow = async (db) => {
    await db('ws_rest_endpoints').insert({
        id: ENDPOINT_ID,
        url: 'https://channel.example.test/v1/channel/email/rule',
        body: JSON.stringify({ body: 'context.channel_hub_tag' }),
        deleted_at: null,
    });

    await db('ws_rest_workflow_steps').insert([
        {
            id: 'before-step-id',
            flow_id: FLOW_ID,
            order: 2,
            function_id: 'before-function-id',
            deleted_at: null,
        },
        {
            id: ENDPOINT_STEP_ID,
            flow_id: FLOW_ID,
            order: 3,
            endpoint_id: ENDPOINT_ID,
            deleted_at: null,
        },
        {
            id: AFTER_STEP_ID,
            flow_id: FLOW_ID,
            order: 4,
            function_id: 'after-function-id',
            deleted_at: null,
        },
    ]);
};

const getEndpointBody = async (db) => {
    const endpoint = await db('ws_rest_endpoints').where({ id: ENDPOINT_ID }).first('body');
    return endpoint.body;
};

const getWorkflowStepOrder = async (db, id) => {
    const step = await db('ws_rest_workflow_steps').where({ id }).first('order');
    return step.order;
};

const getNormalizerSteps = async (db) =>
    db('ws_rest_workflow_steps')
        .where({
            flow_id: FLOW_ID,
            function_id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID,
        })
        .whereNull('deleted_at')
        .orderBy('order');

const getNormalizerFunctions = async (db) =>
    db('ws_rest_functions').where({ id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID });

test('updates create-tag endpoint body to normalized request context', () => {
    const existingBody = JSON.stringify({ body: 'context.channel_hub_tag' });

    assert.equal(
        normalizeCreateTagEndpointBody(existingBody),
        JSON.stringify({ body: CHANNEL_HUB_TAG_REQUEST_CONTEXT_PATH })
    );
});

test('restores compact raw tag context body on rollback', () => {
    const existingBody = JSON.stringify({ body: CHANNEL_HUB_TAG_REQUEST_CONTEXT_PATH });

    assert.equal(restoreCompactChannelHubTagBody(existingBody), JSON.stringify({ body: 'context.channel_hub_tag' }));
});

test('preserves object body serialization when normalizing and restoring', () => {
    assert.deepEqual(normalizeCreateTagEndpointBody({ body: 'context.channel_hub_tag' }), {
        body: CHANNEL_HUB_TAG_REQUEST_CONTEXT_PATH,
    });
    assert.deepEqual(restoreCompactChannelHubTagBody({ body: CHANNEL_HUB_TAG_REQUEST_CONTEXT_PATH }), {
        body: 'context.channel_hub_tag',
    });
});

test('builds the normalizer function row', () => {
    assert.deepEqual(buildNormalizerFunctionRow('2026-05-22 12:00:00 -05:00'), {
        id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID,
        description: 'Channel Hub - Normalize email rule body',
        type: 'normalizeChannelHubRule',
        filter_input: JSON.stringify({ filter_input: ['channel_hub_tag'] }),
        context_position: 'channel_hub_tag_request',
        value_dynamic: false,
        value_static: null,
        is_active: true,
        created_at: '2026-05-22 12:00:00 -05:00',
        created_by: '7d15692d-5bf4-4135-8096-06e7b1098b54',
        updated_at: '2026-05-22 12:00:00 -05:00',
        updated_by: '7d15692d-5bf4-4135-8096-06e7b1098b54',
        deleted_at: null,
        deleted_by: null,
    });
});

test('builds a normalizer workflow step before the endpoint order', () => {
    const row = buildNormalizerStepRow({
        id: 'step-id',
        flow_id: 'flow-id',
        order: 3,
        createdAt: '2026-05-22 12:00:00 -05:00',
    });

    assert.deepEqual(row, {
        id: 'step-id',
        flow_id: 'flow-id',
        order: 3,
        endpoint_id: null,
        function_id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID,
        conditional_id: null,
        parent_step_id: null,
        created_at: '2026-05-22 12:00:00 -05:00',
        created_by: '7d15692d-5bf4-4135-8096-06e7b1098b54',
        updated_at: null,
        updated_by: null,
        deleted_at: null,
        deleted_by: null,
    });
});

test('inserts a normalizer step only when an active one is absent', () => {
    assert.equal(shouldInsertNormalizerStep(null), true);
    assert.equal(shouldInsertNormalizerStep({ id: 'existing-step-id' }), false);
});

test('up is idempotent and down restores the Channel Hub workflow order and body', async () => {
    const db = await createTestDatabase();

    try {
        await insertChannelHubEndpointFlow(db);

        await up(db);

        const normalizerFunctionsAfterFirstUp = await getNormalizerFunctions(db);
        assert.equal(normalizerFunctionsAfterFirstUp.length, 1);
        assert.equal(normalizerFunctionsAfterFirstUp[0].id, NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID);
        assert.equal(normalizerFunctionsAfterFirstUp[0].description, 'Channel Hub - Normalize email rule body');
        assert.equal(normalizerFunctionsAfterFirstUp[0].type, 'normalizeChannelHubRule');
        assert.equal(normalizerFunctionsAfterFirstUp[0].context_position, 'channel_hub_tag_request');
        assert.equal(
            await getEndpointBody(db),
            JSON.stringify({
                body: CHANNEL_HUB_TAG_REQUEST_CONTEXT_PATH,
            })
        );

        const normalizerStepsAfterFirstUp = await getNormalizerSteps(db);
        assert.equal(normalizerStepsAfterFirstUp.length, 1);
        assert.equal(normalizerStepsAfterFirstUp[0].order, 3);
        assert.equal(await getWorkflowStepOrder(db, ENDPOINT_STEP_ID), 4);
        assert.equal(await getWorkflowStepOrder(db, AFTER_STEP_ID), 5);

        await up(db);

        assert.equal((await getNormalizerFunctions(db)).length, 1);

        const normalizerStepsAfterSecondUp = await getNormalizerSteps(db);
        assert.equal(normalizerStepsAfterSecondUp.length, 1);
        assert.equal(normalizerStepsAfterSecondUp[0].order, 3);
        assert.equal(await getWorkflowStepOrder(db, ENDPOINT_STEP_ID), 4);
        assert.equal(await getWorkflowStepOrder(db, AFTER_STEP_ID), 5);

        await down(db);

        assert.equal(await getEndpointBody(db), JSON.stringify({ body: 'context.channel_hub_tag' }));
        assert.deepEqual(await getNormalizerFunctions(db), []);
        assert.deepEqual(await getNormalizerSteps(db), []);
        assert.equal(await getWorkflowStepOrder(db, ENDPOINT_STEP_ID), 3);
        assert.equal(await getWorkflowStepOrder(db, AFTER_STEP_ID), 4);
    } finally {
        await db.destroy();
    }
});

test('up updates an existing normalizer function without duplicating it', async () => {
    const db = await createTestDatabase();

    try {
        await db('ws_rest_functions').insert({
            id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID,
            description: 'stale description',
            type: 'staleType',
            filter_input: JSON.stringify({ filter_input: ['stale'] }),
            context_position: 'stale_position',
            value_dynamic: true,
            value_static: 'stale',
            is_active: false,
            created_at: '2026-05-21 12:00:00 -05:00',
            created_by: 'stale-user-id',
            updated_at: '2026-05-21 12:00:00 -05:00',
            updated_by: 'stale-user-id',
            deleted_at: '2026-05-21 12:00:00 -05:00',
            deleted_by: 'stale-user-id',
        });

        await up(db);
        await up(db);

        const functions = await getNormalizerFunctions(db);
        assert.equal(functions.length, 1);
        assert.equal(functions[0].description, 'Channel Hub - Normalize email rule body');
        assert.equal(functions[0].type, 'normalizeChannelHubRule');
        assert.equal(functions[0].filter_input, JSON.stringify({ filter_input: ['channel_hub_tag'] }));
        assert.equal(functions[0].context_position, 'channel_hub_tag_request');
        assert.equal(functions[0].value_static, null);
        assert.equal(functions[0].deleted_at, null);
        assert.equal(functions[0].deleted_by, null);
    } finally {
        await db.destroy();
    }
});
