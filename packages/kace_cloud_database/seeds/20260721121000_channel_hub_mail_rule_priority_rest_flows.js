const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_FLOWS_TABLE = 'ws_rest_flows';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';

const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-07-21 12:10:00.000000 -05:00';
const AUTH_ENDPOINT_ID = '06cf3374-f17b-4109-8d37-b16584f91a73';
const MAIL_RULE_URL = 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule';

const LIST_ENDPOINT_ID = '9d2cf458-b1da-4366-a8e9-09056fab75d5';
const LIST_FLOW_ID = '97c63872-c414-47db-8671-9d060345af26';
const LIST_STEP_ID = 'd20b8835-f013-4a72-9da3-f8931c25ba79';
const UPDATE_ENDPOINT_ID = '1e76a3ab-4933-452b-8f14-d564bfdb4de9';
const UPDATE_FLOW_ID = 'a67046c5-fd1a-4433-96cc-2ffa3e405809';
const UPDATE_STEP_ID = 'd4c92912-adb6-4fa4-a133-66d55278a8d3';

const baseCatalogRow = {
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: CREATED_AT,
    updated_by: SYSTEM_USER_ID,
    deleted_at: null,
    deleted_by: null,
};

const buildEndpoint = ({ id, description, url, method, body, contextPosition }) => ({
    id,
    type: 'consumption',
    description,
    url,
    method,
    headers: JSON.stringify({
        headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' },
    }),
    body: JSON.stringify({ body }),
    is_dynamic_body: true,
    is_active: true,
    ...baseCatalogRow,
    authorization_id: AUTH_ENDPOINT_ID,
    is_dynamic_header: true,
    filter_input: JSON.stringify({ filter_input: [] }),
    context_position: contextPosition,
    on_success: JSON.stringify({ on_success: {} }),
    on_error: JSON.stringify({ on_error: {} }),
    attempts: 0,
    initial_context: JSON.stringify({ initial_context: {} }),
    body_type: 'json',
    cache_expires_in_path: null,
    cache_default_ttl_seconds: null,
});

const listEndpoint = buildEndpoint({
    id: LIST_ENDPOINT_ID,
    description: 'Channel Hub - Listar reglas de correo',
    url: `${MAIL_RULE_URL}/context.channel_hub_mail_rules.connectionId`,
    method: 'GET',
    body: {},
    contextPosition: 'channel_hub_mail_rules.list_response',
});

const updateEndpoint = buildEndpoint({
    id: UPDATE_ENDPOINT_ID,
    description: 'Channel Hub - Actualizar prioridad de regla de correo',
    url: `${MAIL_RULE_URL}/context.channel_hub_mail_rules.connectionId/context.channel_hub_mail_rules.ruleId`,
    method: 'PATCH',
    body: { priority: 'context.channel_hub_mail_rules.priority' },
    contextPosition: 'channel_hub_mail_rules.update_response',
});

const buildDiagram = (endpoint) =>
    JSON.stringify({
        edges: [
            {
                id: `reactflow__edge-0-${endpoint.id}`,
                data: { is_visible: true },
                type: 'custom',
                source: '0',
                target: endpoint.id,
                sourceHandle: null,
                targetHandle: null,
            },
        ],
        nodes: [
            {
                id: '0',
                data: { label: 'inicio' },
                type: 'input',
                width: 150,
                height: 40,
                position: { x: 225, y: 75 },
            },
            {
                id: endpoint.id,
                data: { id: endpoint.id, type: 'endpoint', label: endpoint.description },
                style: {
                    color: 'black',
                    wordBreak: 'break-word',
                    backgroundColor: 'rgb(232, 196, 104)',
                },
                width: 150,
                height: 58,
                position: { x: 225, y: 230 },
            },
        ],
    });

const listFlow = {
    id: LIST_FLOW_ID,
    description: 'Channel Hub - Listar reglas de correo por conexión',
    is_active: true,
    ...baseCatalogRow,
    external_code: 'channelhub-mail-rules-list',
    json_diagram_properties: buildDiagram(listEndpoint),
    is_primary: true,
    initial_context: null,
};

const updateFlow = {
    id: UPDATE_FLOW_ID,
    description: 'Channel Hub - Actualizar prioridad de regla de correo',
    is_active: true,
    ...baseCatalogRow,
    external_code: 'channelhub-mail-rule-priority-update',
    json_diagram_properties: buildDiagram(updateEndpoint),
    is_primary: true,
    initial_context: null,
};

const listStep = {
    id: LIST_STEP_ID,
    flow_id: LIST_FLOW_ID,
    order: 1,
    endpoint_id: LIST_ENDPOINT_ID,
    function_id: null,
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    parent_step_id: null,
    conditional_id: null,
};

const updateStep = {
    id: UPDATE_STEP_ID,
    flow_id: UPDATE_FLOW_ID,
    order: 1,
    endpoint_id: UPDATE_ENDPOINT_ID,
    function_id: null,
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    parent_step_id: null,
    conditional_id: null,
};

const upsertById = async (knex, table, row) => {
    const mergeColumns = Object.fromEntries(
        Object.entries(row).filter(([column]) => !['id', 'created_at', 'created_by'].includes(column))
    );
    await knex(table).insert(row).onConflict('id').merge(mergeColumns);
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
export async function seed(knex) {
    for (const endpoint of [listEndpoint, updateEndpoint]) {
        await upsertById(knex, WS_REST_ENDPOINTS_TABLE, endpoint);
    }
    for (const flow of [listFlow, updateFlow]) {
        await upsertById(knex, WS_REST_FLOWS_TABLE, flow);
    }
    for (const step of [listStep, updateStep]) {
        await upsertById(knex, WS_REST_WORKFLOW_STEPS_TABLE, step);
    }
}
