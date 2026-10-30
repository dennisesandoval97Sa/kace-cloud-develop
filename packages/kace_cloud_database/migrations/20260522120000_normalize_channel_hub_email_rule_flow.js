import { randomUUID } from 'node:crypto';

const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_FUNCTIONS_TABLE = 'ws_rest_functions';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';
const CHANNEL_HUB_EMAIL_RULE_URL_PATTERN = '%/v1/channel/email/rule';
const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-05-22 12:00:00 -05:00';

export const NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID = 'b21e3fb8-63e4-4ca0-91a0-1e58908bfa2f';
export const CHANNEL_HUB_TAG_REQUEST_CONTEXT_PATH = 'context.channel_hub_tag_request';

const parseBody = (rawBody) => {
    if (typeof rawBody === 'string') {
        return JSON.parse(rawBody);
    }
    return rawBody;
};

const serializeBody = (body, originalBody) => (typeof originalBody === 'string' ? JSON.stringify(body) : body);

export function normalizeCreateTagEndpointBody(rawBody) {
    parseBody(rawBody);
    return serializeBody({ body: CHANNEL_HUB_TAG_REQUEST_CONTEXT_PATH }, rawBody);
}

export function restoreCompactChannelHubTagBody(rawBody) {
    parseBody(rawBody);
    return serializeBody({ body: 'context.channel_hub_tag' }, rawBody);
}

export function buildNormalizerFunctionRow(createdAt = CREATED_AT) {
    return {
        id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID,
        description: 'Channel Hub - Normalize email rule body',
        type: 'normalizeChannelHubRule',
        filter_input: JSON.stringify({ filter_input: ['channel_hub_tag'] }),
        context_position: 'channel_hub_tag_request',
        value_dynamic: false,
        value_static: null,
        is_active: true,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: createdAt,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
    };
}

export function buildNormalizerStepRow({ id, flow_id, order, createdAt = CREATED_AT }) {
    return {
        id,
        flow_id,
        order,
        endpoint_id: null,
        function_id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID,
        conditional_id: null,
        parent_step_id: null,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: null,
        updated_by: null,
        deleted_at: null,
        deleted_by: null,
    };
}

export function shouldInsertNormalizerStep(existingStep) {
    return !existingStep;
}

async function ensureNormalizerFunction(knex) {
    const row = buildNormalizerFunctionRow();
    const existing = await knex(WS_REST_FUNCTIONS_TABLE)
        .where({ id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID })
        .first('id');

    if (existing) {
        await knex(WS_REST_FUNCTIONS_TABLE).where({ id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID }).update({
            description: row.description,
            type: row.type,
            filter_input: row.filter_input,
            context_position: row.context_position,
            value_dynamic: row.value_dynamic,
            value_static: row.value_static,
            is_active: row.is_active,
            updated_at: row.updated_at,
            updated_by: row.updated_by,
            deleted_at: null,
            deleted_by: null,
        });
        return;
    }

    await knex(WS_REST_FUNCTIONS_TABLE).insert(row);
}

async function updateMatchingEndpointBodies(knex, transform) {
    const endpoints = await knex(WS_REST_ENDPOINTS_TABLE)
        .select('id', 'body')
        .where('url', 'like', CHANNEL_HUB_EMAIL_RULE_URL_PATTERN)
        .whereNull('deleted_at');

    for (const endpoint of endpoints) {
        const updatedBody = transform(endpoint.body);
        if (JSON.stringify(updatedBody) === JSON.stringify(endpoint.body)) continue;

        await knex(WS_REST_ENDPOINTS_TABLE).where({ id: endpoint.id }).update({ body: updatedBody });
    }
}

async function ensureNormalizerSteps(knex) {
    const endpointSteps = await knex(`${WS_REST_WORKFLOW_STEPS_TABLE} as steps`)
        .join(`${WS_REST_ENDPOINTS_TABLE} as endpoints`, 'steps.endpoint_id', 'endpoints.id')
        .select('steps.flow_id', 'steps.order')
        .where('endpoints.url', 'like', CHANNEL_HUB_EMAIL_RULE_URL_PATTERN)
        .whereNull('steps.deleted_at')
        .whereNull('endpoints.deleted_at');

    for (const step of endpointSteps) {
        const existingNormalizerStep = await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({ flow_id: step.flow_id, function_id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID })
            .whereNull('deleted_at')
            .first('id');

        if (!shouldInsertNormalizerStep(existingNormalizerStep)) continue;

        await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({ flow_id: step.flow_id })
            .whereNull('deleted_at')
            .where('order', '>=', step.order)
            .increment('order', 1);

        await knex(WS_REST_WORKFLOW_STEPS_TABLE).insert(
            buildNormalizerStepRow({
                id: randomUUID(),
                flow_id: step.flow_id,
                order: step.order,
            })
        );
    }
}

async function removeNormalizerSteps(knex) {
    const normalizerSteps = await knex(WS_REST_WORKFLOW_STEPS_TABLE)
        .select('id', 'flow_id', 'order')
        .where({ function_id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID })
        .whereNull('deleted_at')
        .orderBy('flow_id')
        .orderBy('order', 'desc');

    for (const step of normalizerSteps) {
        await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({ flow_id: step.flow_id })
            .whereNull('deleted_at')
            .where('order', '>', step.order)
            .decrement('order', 1);

        await knex(WS_REST_WORKFLOW_STEPS_TABLE).where({ id: step.id }).del();
    }
}

export async function up(knex) {
    await ensureNormalizerFunction(knex);
    await ensureNormalizerSteps(knex);
    await updateMatchingEndpointBodies(knex, normalizeCreateTagEndpointBody);
}

export async function down(knex) {
    await updateMatchingEndpointBodies(knex, restoreCompactChannelHubTagBody);
    await removeNormalizerSteps(knex);
    await knex(WS_REST_FUNCTIONS_TABLE).where({ id: NORMALIZE_CHANNEL_HUB_RULE_FUNCTION_ID }).del();
}
