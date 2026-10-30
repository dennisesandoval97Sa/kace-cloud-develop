const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_FLOWS_TABLE = 'ws_rest_flows';
const WS_REST_FUNCTIONS_TABLE = 'ws_rest_functions';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';

const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-05-21 18:00:00.000000 -05:00';
const AUTH_ENDPOINT_ID = '06cf3374-f17b-4109-8d37-b16584f91a73';
const EMAIL_RULE_URL = 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule';
const EMAIL_RULE_WITH_ID_URL = `${EMAIL_RULE_URL}/context.channel_hub_tag.connectionId/context.channel_hub_tag.ruleId`;
const NORMALIZE_FUNCTION_ID = 'b21e3fb8-63e4-4ca0-91a0-1e58908bfa2f';
const CREATE_TAG_ENDPOINT_ID = '5ac4c03c-f840-4fa4-aaea-60734b08a02f';
const UPDATE_TAG_ENDPOINT_ID = '5a003061-9952-4df2-8372-c6c1b4579091';
const DELETE_TAG_ENDPOINT_ID = '6c1327b4-fdd8-47a9-8477-78aa73703342';
const CREATE_TAG_FLOW_ID = 'e312b262-c8d9-4d0a-bb5f-570c32e269fb';
const UPDATE_TAG_FLOW_ID = '55412142-44b3-4691-bf63-fa269b6492a3';
const DELETE_TAG_FLOW_ID = '29566dce-a460-4992-af20-cfd4e151208b';
const CREATE_TAG_NORMALIZE_STEP_ID = 'd2d01852-f576-4f11-aa15-f22234fb9b86';
const CREATE_TAG_ENDPOINT_STEP_ID = 'b3e93829-024b-4f16-911d-630f448ca05f';
const UPDATE_TAG_NORMALIZE_STEP_ID = '7527be9f-4117-45d2-89b1-774f77d1089e';
const UPDATE_TAG_ENDPOINT_STEP_ID = '6b2eba53-f8b2-4089-97d9-1c73d2d5d756';
const DELETE_TAG_STEP_ID = 'e2ce7304-e84c-46fa-ba2f-cef98e966a62';

const authHeaders = JSON.stringify({
    headers: {
        Authorization: 'Bearer context.channel_hub.auth.access_token',
    },
});

const baseCatalogRow = {
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: CREATED_AT,
    updated_by: SYSTEM_USER_ID,
    deleted_at: null,
    deleted_by: null,
};

const normalizeFunction = {
    id: NORMALIZE_FUNCTION_ID,
    description: 'Channel Hub - Normalize email rule body',
    type: 'normalizeChannelHubRule',
    filter_input: JSON.stringify({ filter_input: ['channel_hub_tag'] }),
    context_position: 'channel_hub_tag_request',
    value_dynamic: false,
    value_static: null,
    is_active: true,
    ...baseCatalogRow,
};

const buildTagEndpoint = ({ id, description, url, method, body, contextPosition }) => ({
    id,
    type: 'consumption',
    description,
    url,
    method,
    headers: authHeaders,
    body: JSON.stringify(body),
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

const createTagEndpoint = buildTagEndpoint({
    id: CREATE_TAG_ENDPOINT_ID,
    description: 'Channel Hub - Crear Tag (email rule)',
    url: EMAIL_RULE_URL,
    method: 'POST',
    body: { body: 'context.channel_hub_tag_request' },
    contextPosition: 'channel_hub_tag.response',
});

const updateTagEndpoint = buildTagEndpoint({
    id: UPDATE_TAG_ENDPOINT_ID,
    description: 'Channel Hub - Actualizar Tag (email rule)',
    url: EMAIL_RULE_WITH_ID_URL,
    method: 'PUT',
    body: { body: 'context.channel_hub_tag_request' },
    contextPosition: 'channel_hub_tag.response',
});

const deleteTagEndpoint = buildTagEndpoint({
    id: DELETE_TAG_ENDPOINT_ID,
    description: 'Channel Hub - Eliminar tag (email rule)',
    url: EMAIL_RULE_WITH_ID_URL,
    method: 'DELETE',
    body: { body: {} },
    contextPosition: 'channel_hub_tag.delete_response',
});

const buildLinearDiagram = ({ endpointId, endpointLabel, includeNormalizer }) => {
    const nodes = [
        {
            id: '0',
            data: { label: 'inicio' },
            type: 'input',
            width: 150,
            height: 40,
            position: { x: 225, y: 75 },
        },
    ];
    const edges = [];

    if (includeNormalizer) {
        nodes.push({
            id: NORMALIZE_FUNCTION_ID,
            data: {
                id: NORMALIZE_FUNCTION_ID,
                type: 'function',
                label: 'Channel Hub - Normalize email rule body',
            },
            style: {
                color: 'white',
                wordBreak: 'break-word',
                backgroundColor: 'rgb(236, 98, 72)',
            },
            width: 150,
            height: 76,
            position: { x: 225, y: 205 },
        });
        edges.push({
            id: `reactflow__edge-0-${NORMALIZE_FUNCTION_ID}`,
            data: { is_visible: true },
            type: 'custom',
            source: '0',
            target: NORMALIZE_FUNCTION_ID,
            sourceHandle: null,
            targetHandle: null,
        });
    }

    nodes.push({
        id: endpointId,
        data: {
            id: endpointId,
            type: 'endpoint',
            label: endpointLabel,
        },
        style: {
            color: 'black',
            wordBreak: 'break-word',
            backgroundColor: 'rgb(232, 196, 104)',
        },
        width: 150,
        height: 58,
        position: { x: 225, y: includeNormalizer ? 355 : 230 },
    });
    edges.push({
        id: `reactflow__edge-${includeNormalizer ? NORMALIZE_FUNCTION_ID : '0'}-${endpointId}`,
        data: { is_visible: true },
        type: 'custom',
        source: includeNormalizer ? NORMALIZE_FUNCTION_ID : '0',
        target: endpointId,
        sourceHandle: null,
        targetHandle: null,
    });

    return JSON.stringify({ edges, nodes });
};

const buildTagFlow = ({ id, description, externalCode, endpointId, endpointLabel, includeNormalizer }) => ({
    id,
    description,
    is_active: true,
    ...baseCatalogRow,
    external_code: externalCode,
    json_diagram_properties: buildLinearDiagram({ endpointId, endpointLabel, includeNormalizer }),
    is_primary: true,
    initial_context: null,
});

const createTagFlow = buildTagFlow({
    id: CREATE_TAG_FLOW_ID,
    description: 'Channel Hub - Crear tag',
    externalCode: 'channelhub-tag-create',
    endpointId: CREATE_TAG_ENDPOINT_ID,
    endpointLabel: 'Channel Hub - Crear Tag (email rule)',
    includeNormalizer: true,
});

const updateTagFlow = buildTagFlow({
    id: UPDATE_TAG_FLOW_ID,
    description: 'Channel Hub - Actualizar tag',
    externalCode: 'channelhub-tag-update',
    endpointId: UPDATE_TAG_ENDPOINT_ID,
    endpointLabel: 'Channel Hub - Actualizar Tag (email rule)',
    includeNormalizer: true,
});

const deleteTagFlow = buildTagFlow({
    id: DELETE_TAG_FLOW_ID,
    description: 'Channel Hub - Eliminar tag',
    externalCode: 'channelhub-tag-delete',
    endpointId: DELETE_TAG_ENDPOINT_ID,
    endpointLabel: 'Channel Hub - Eliminar tag (email rule)',
    includeNormalizer: false,
});

const buildWorkflowStep = ({ id, flowId, order, endpointId = null, functionId = null }) => ({
    id,
    flow_id: flowId,
    order,
    endpoint_id: endpointId,
    function_id: functionId,
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    parent_step_id: null,
    conditional_id: null,
});

const workflowSteps = [
    buildWorkflowStep({
        id: CREATE_TAG_NORMALIZE_STEP_ID,
        flowId: CREATE_TAG_FLOW_ID,
        order: 1,
        functionId: NORMALIZE_FUNCTION_ID,
    }),
    buildWorkflowStep({
        id: CREATE_TAG_ENDPOINT_STEP_ID,
        flowId: CREATE_TAG_FLOW_ID,
        order: 2,
        endpointId: CREATE_TAG_ENDPOINT_ID,
    }),
    buildWorkflowStep({
        id: UPDATE_TAG_NORMALIZE_STEP_ID,
        flowId: UPDATE_TAG_FLOW_ID,
        order: 1,
        functionId: NORMALIZE_FUNCTION_ID,
    }),
    buildWorkflowStep({
        id: UPDATE_TAG_ENDPOINT_STEP_ID,
        flowId: UPDATE_TAG_FLOW_ID,
        order: 2,
        endpointId: UPDATE_TAG_ENDPOINT_ID,
    }),
    buildWorkflowStep({
        id: DELETE_TAG_STEP_ID,
        flowId: DELETE_TAG_FLOW_ID,
        order: 1,
        endpointId: DELETE_TAG_ENDPOINT_ID,
    }),
];

const upsertById = async (knex, table, row) => {
    const { id, created_at: _createdAt, created_by: _createdBy, ...mergeColumns } = row;
    await knex(table).insert(row).onConflict('id').merge(mergeColumns);
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    await upsertById(knex, WS_REST_FUNCTIONS_TABLE, normalizeFunction);

    for (const endpoint of [createTagEndpoint, updateTagEndpoint, deleteTagEndpoint]) {
        await upsertById(knex, WS_REST_ENDPOINTS_TABLE, endpoint);
    }

    for (const flow of [createTagFlow, updateTagFlow, deleteTagFlow]) {
        await upsertById(knex, WS_REST_FLOWS_TABLE, flow);
    }

    for (const workflowStep of workflowSteps) {
        await upsertById(knex, WS_REST_WORKFLOW_STEPS_TABLE, workflowStep);
    }
}
