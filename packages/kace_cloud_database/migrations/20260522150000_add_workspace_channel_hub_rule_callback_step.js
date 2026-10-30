import { randomUUID } from 'node:crypto';

const ALLOWED_CONNECTIONS_TABLE = 'allowed_connections';
const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_FLOWS_TABLE = 'ws_rest_flows';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';
const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-05-22 15:00:00 -05:00';
const CHANNEL_HUB_CREATE_EMAIL_RULE_URL_PATTERN = '%/v1/channel/email/rule';

export const KACE_API_ALLOWED_CONNECTION_ID = '2aa5ab01-96ed-4f06-bfe8-467ffb04266d';
export const KACE_TENANT_API_ALLOWED_CONNECTION_ID = 'c4c23072-54c6-4d6f-8b7d-e3a0b03f8ed9';
export const KACE_SERVICE_AUTH_ENDPOINT_ID = 'b62dbe60-3db6-4a98-8884-1fb469a09ace';
export const WORKSPACE_RULE_CALLBACK_ENDPOINT_ID = '9d7f3e6f-41d4-48ea-a8f1-8c725c0d7be0';
export const CALLBACK_ERROR_HOOK_EXTERNAL_CODE = 'workspace-channelhub-rule-callback-error';

const KACE_API_DOMAIN = 'api.konecta.cloud';
const CALLBACK_ERROR_STATUS_MAP = {
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
};

function normalizeConnectionDomain(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
        return null;
    }

    const url = /^[a-z][a-z\d+\-.]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        return new URL(url).host;
    } catch (_error) {
        return raw.replace(/^https?:\/\//, '').split('/')[0] || null;
    }
}

function tenantApiDomainFromEnvironment(env = process.env) {
    const executeRestHookDomain = normalizeConnectionDomain(env.APPS_EXECUTE_REST_HOOK_SERVICE_URL);
    if (executeRestHookDomain) {
        return executeRestHookDomain;
    }

    const subdomain = typeof env.APPS_API_SUBDOMAIN === 'string' ? env.APPS_API_SUBDOMAIN.trim() : '';
    const domain = typeof env.APPS_DOMAIN === 'string' ? env.APPS_DOMAIN.trim() : '';
    if (subdomain && domain) {
        return normalizeConnectionDomain(`${subdomain}.${domain}`);
    }

    return null;
}

export function buildKaceApiAllowedConnectionRow(createdAt = CREATED_AT, overrides = {}) {
    const {
        id = KACE_API_ALLOWED_CONNECTION_ID,
        connection = KACE_API_DOMAIN,
        description = 'KACE Cloud API',
    } = overrides;

    return {
        id,
        description,
        connection,
        certificate: null,
        is_active: true,
        has_ssl: false,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: createdAt,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
    };
}

export function buildKaceApiAllowedConnectionRows({ createdAt = CREATED_AT, env = process.env } = {}) {
    const rows = [
        buildKaceApiAllowedConnectionRow(createdAt),
        buildKaceApiAllowedConnectionRow(createdAt, {
            id: KACE_TENANT_API_ALLOWED_CONNECTION_ID,
            connection: tenantApiDomainFromEnvironment(env),
            description: 'KACE Cloud API tenant host',
        }),
    ];

    const rowsByDomain = new Map();
    for (const row of rows) {
        if (!row.connection || rowsByDomain.has(row.connection)) continue;
        rowsByDomain.set(row.connection, row);
    }

    return Array.from(rowsByDomain.values());
}

export function buildKaceServiceAuthEndpointRow(createdAt = CREATED_AT) {
    return {
        id: KACE_SERVICE_AUTH_ENDPOINT_ID,
        type: 'authorization',
        description: 'KACE Cloud - RestFlow service account auth',
        url: 'context.kace_api_base_url/auth-cognito',
        method: 'POST',
        headers: JSON.stringify({
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Fingerprint': 'kace-restflow-callback',
                'X-Tenant-ID': 'context.tenant_id',
            },
        }),
        body: JSON.stringify({
            body: {
                username: 'SECRET_KACE_RESTFLOW_CALLBACK_USERNAME',
                password: 'SECRET_KACE_RESTFLOW_CALLBACK_PASSWORD',
            },
        }),
        is_dynamic_body: true,
        is_active: true,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: createdAt,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: null,
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: ['data.id_token'] }),
        context_position: 'kace.auth',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
        body_type: 'json',
        cache_expires_in_path: null,
        cache_default_ttl_seconds: null,
    };
}

export function buildWorkspaceRuleCallbackEndpointRow(createdAt = CREATED_AT) {
    return {
        id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
        type: 'consumption',
        description: 'Workspace - Persist Channel Hub Rule Id',
        url: 'context.kace_api_base_url/workspaces/context.workspace.id/channel-hub-tags/rule-created',
        method: 'POST',
        headers: JSON.stringify({
            headers: {
                Authorization: 'context.kace.auth.id_token',
                'X-Client-Fingerprint': 'kace-restflow-callback',
                'X-Tenant-ID': 'context.tenant_id',
            },
        }),
        body: JSON.stringify({
            body: {
                channel_hub_account_id: 'context.workspace.channel_hub_accounts[0].id',
                connection_id: 'context.channel_hub_tag.response.connectionId',
                rule_id: 'context.channel_hub_tag.response.id',
            },
        }),
        is_dynamic_body: true,
        is_active: true,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: createdAt,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID,
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: [] }),
        context_position: 'workspace.channel_hub_tag_rule_created',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: CALLBACK_ERROR_STATUS_MAP }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
        body_type: 'json',
        cache_expires_in_path: null,
        cache_default_ttl_seconds: null,
    };
}

function buildCallbackStepRow({ flowId, order, parentStepId, createdAt = CREATED_AT }) {
    return {
        id: randomUUID(),
        flow_id: flowId,
        order,
        endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
        function_id: null,
        conditional_id: null,
        parent_step_id: parentStepId,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: null,
        updated_by: null,
        deleted_at: null,
        deleted_by: null,
    };
}

async function ensureKaceApiAllowedConnection(knex) {
    for (const row of buildKaceApiAllowedConnectionRows()) {
        const existingByDomain = await knex(ALLOWED_CONNECTIONS_TABLE)
            .where({ connection: row.connection })
            .whereNull('deleted_at')
            .first('id');

        if (existingByDomain) {
            await knex(ALLOWED_CONNECTIONS_TABLE).where({ id: existingByDomain.id }).update({
                description: row.description,
                is_active: row.is_active,
                has_ssl: row.has_ssl,
                updated_at: row.updated_at,
                updated_by: row.updated_by,
            });
            continue;
        }

        await knex(ALLOWED_CONNECTIONS_TABLE).insert(row);
    }
}

async function upsertEndpoint(knex, row) {
    const existing = await knex(WS_REST_ENDPOINTS_TABLE).where({ id: row.id }).first('id');
    if (!existing) {
        await knex(WS_REST_ENDPOINTS_TABLE).insert(row);
        return;
    }

    await knex(WS_REST_ENDPOINTS_TABLE).where({ id: row.id }).update({
        type: row.type,
        description: row.description,
        url: row.url,
        method: row.method,
        headers: row.headers,
        body: row.body,
        is_dynamic_body: row.is_dynamic_body,
        is_active: row.is_active,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
        deleted_at: row.deleted_at,
        deleted_by: row.deleted_by,
        authorization_id: row.authorization_id,
        is_dynamic_header: row.is_dynamic_header,
        filter_input: row.filter_input,
        context_position: row.context_position,
        on_success: row.on_success,
        on_error: row.on_error,
        attempts: row.attempts,
        initial_context: row.initial_context,
        body_type: row.body_type,
        cache_expires_in_path: row.cache_expires_in_path,
        cache_default_ttl_seconds: row.cache_default_ttl_seconds,
    });
}

async function ensureEndpoints(knex) {
    await upsertEndpoint(knex, buildKaceServiceAuthEndpointRow());
    await upsertEndpoint(knex, buildWorkspaceRuleCallbackEndpointRow());
}

async function findCreateTagEndpointSteps(knex) {
    return knex(`${WS_REST_WORKFLOW_STEPS_TABLE} as steps`)
        .join(`${WS_REST_ENDPOINTS_TABLE} as endpoints`, 'steps.endpoint_id', 'endpoints.id')
        .join(`${WS_REST_FLOWS_TABLE} as flows`, 'steps.flow_id', 'flows.id')
        .select('steps.id', 'steps.flow_id', 'steps.order')
        .where('endpoints.url', 'like', CHANNEL_HUB_CREATE_EMAIL_RULE_URL_PATTERN)
        .whereRaw('upper(endpoints.method) = ?', ['POST'])
        .where('endpoints.is_active', true)
        .where('flows.is_active', true)
        .whereNull('steps.deleted_at')
        .whereNull('endpoints.deleted_at')
        .whereNull('flows.deleted_at')
        .orderBy('steps.flow_id')
        .orderBy('steps.order', 'desc');
}

async function ensureCallbackSteps(knex) {
    const createTagSteps = await findCreateTagEndpointSteps(knex);

    for (const step of createTagSteps) {
        const existingCallbackStep = await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({
                flow_id: step.flow_id,
                endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
                parent_step_id: step.id,
            })
            .whereNull('deleted_at')
            .first('id');

        if (existingCallbackStep) continue;

        const callbackOrder = step.order + 1;
        await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({ flow_id: step.flow_id })
            .whereNull('deleted_at')
            .where('order', '>=', callbackOrder)
            .increment('order', 1);

        await knex(WS_REST_WORKFLOW_STEPS_TABLE).insert(
            buildCallbackStepRow({ flowId: step.flow_id, order: callbackOrder, parentStepId: step.id })
        );
    }
}

async function removeCallbackSteps(knex) {
    const callbackSteps = await knex(WS_REST_WORKFLOW_STEPS_TABLE)
        .select('id', 'flow_id', 'order')
        .where({ endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID })
        .whereNull('deleted_at')
        .orderBy('flow_id')
        .orderBy('order', 'desc');

    for (const step of callbackSteps) {
        await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({ flow_id: step.flow_id })
            .whereNull('deleted_at')
            .where('order', '>', step.order)
            .decrement('order', 1);

        await knex(WS_REST_WORKFLOW_STEPS_TABLE).where({ id: step.id }).del();
    }
}

async function removeOwnedAllowedConnection(knex) {
    await knex(ALLOWED_CONNECTIONS_TABLE)
        .whereIn('id', [KACE_API_ALLOWED_CONNECTION_ID, KACE_TENANT_API_ALLOWED_CONNECTION_ID])
        .del();
}

async function removeOwnedEndpoints(knex) {
    await knex(WS_REST_ENDPOINTS_TABLE).where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).del();

    const authStillReferenced = await knex(WS_REST_ENDPOINTS_TABLE)
        .where({ authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID })
        .first('id');

    if (!authStillReferenced) {
        await knex(WS_REST_ENDPOINTS_TABLE).where({ id: KACE_SERVICE_AUTH_ENDPOINT_ID }).del();
    }
}

export async function up(knex) {
    await ensureKaceApiAllowedConnection(knex);
    await ensureEndpoints(knex);
    await ensureCallbackSteps(knex);
}

export async function down(knex) {
    await removeCallbackSteps(knex);
    await removeOwnedEndpoints(knex);
    await removeOwnedAllowedConnection(knex);
}
