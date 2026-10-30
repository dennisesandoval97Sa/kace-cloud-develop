const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_FLOWS_TABLE = 'ws_rest_flows';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';

const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-03-10 14:42:21.816000 -05:00';
const PRIMARY_FLOW_ID = '4f7f9d13-65b9-445d-a839-d8e0ece2ed03';

const endpoints = [
    {
        id: '06cf3374-f17b-4109-8d37-b16584f91a73',
        type: 'authorization',
        description: 'Channel Hub - auth',
        url: 'https://ch-tst.auth.eu-west-1.amazoncognito.com/oauth2/token',
        method: 'POST',
        headers: JSON.stringify({
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic SECRET_CHANNEL_HUB_AUTH',
            },
        }),
        body: JSON.stringify({ body: { grant_type: 'client_credentials' } }),
        is_dynamic_body: true,
        is_active: true,
        created_at: CREATED_AT,
        created_by: SYSTEM_USER_ID,
        updated_at: CREATED_AT,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: null,
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: ['access_token'] }),
        context_position: 'channel_hub.auth',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
    },
    {
        id: '9867f4fd-67b5-4004-b3dc-4016b6134a8e',
        type: 'consumption',
        description: 'Channel Hub - Obtener connection-id',
        url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/connection/user/context.id',
        method: 'GET',
        headers: JSON.stringify({ headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' } }),
        body: JSON.stringify({ body: {} }),
        is_dynamic_body: true,
        is_active: true,
        created_at: CREATED_AT,
        created_by: SYSTEM_USER_ID,
        updated_at: CREATED_AT,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73',
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: ['connection'] }),
        context_position: 'channel_hub.connection',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
    },
    {
        id: '22d39ff5-7b42-46b3-93b6-b78c193863ce',
        type: 'consumption',
        description: 'Channel Hub - Crear connection',
        url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/connection/email',
        method: 'POST',
        headers: JSON.stringify({ headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' } }),
        body: JSON.stringify({
            body: {
                user: 'context.channel_hub.user',
                countryId: 'context.channel_hub.countryId',
                customerId: 'context.channel_hub.customerId',
                serviceId: 'context.channel_hub.serviceId',
                channelId: 'context.channel_hub.channelId',
                operatorId: 'context.channel_hub.operatorId',
                providerAccountId: 'context.channel_hub.providerAccountId',
                limits: 'context.channel_hub.limits',
                billing: 'context.channel_hub.billing',
                webhooks: 'context.channel_hub.webhooks',
                serviceOwner: 'context.channel_hub.serviceOwner',
                operator: 'context.channel_hub.operator',
            },
        }),
        is_dynamic_body: true,
        is_active: true,
        created_at: CREATED_AT,
        created_by: SYSTEM_USER_ID,
        updated_at: CREATED_AT,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73',
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: [] }),
        context_position: 'channel_hub.connection_response',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
    },
];

const flow = {
    id: PRIMARY_FLOW_ID,
    description: 'Channel Hub - Crear conexion',
    is_active: true,
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: '2026-03-24 18:21:43.072000 -05:00',
    updated_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
    deleted_at: null,
    deleted_by: null,
    external_code: 'channelhub-connection',
    json_diagram_properties: JSON.stringify({
        edges: [
            {
                id: 'reactflow__edge-0-6957b09d-8634-4d13-986e-f54b3edb86c5',
                data: { is_visible: true },
                type: 'custom',
                source: '0',
                target: '6957b09d-8634-4d13-986e-f54b3edb86c5',
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
                dragging: false,
                position: { x: 225, y: 75 },
                selected: false,
                positionAbsolute: { x: 0, y: 0 },
            },
            {
                id: '6957b09d-8634-4d13-986e-f54b3edb86c5',
                data: {
                    id: '22d39ff5-7b42-46b3-93b6-b78c193863ce',
                    type: 'endpoint',
                    label: 'Channel Hub - Crear connection',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 58,
                dragging: false,
                position: { x: 219.51250000000005, y: 231 },
                selected: false,
                positionAbsolute: { x: 219.51250000000005, y: 231 },
            },
        ],
    }),
    is_primary: true,
    initial_context: null,
};

const workflowStep = {
    id: '4fb9911e-d208-46ef-954f-f533d7220bae',
    flow_id: PRIMARY_FLOW_ID,
    order: 1,
    endpoint_id: '22d39ff5-7b42-46b3-93b6-b78c193863ce',
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

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    await knex(WS_REST_ENDPOINTS_TABLE).insert(endpoints).onConflict('id').ignore();
    await knex(WS_REST_FLOWS_TABLE).insert(flow).onConflict('id').ignore();

    const existingPrimaryFlowStep = await knex(WS_REST_WORKFLOW_STEPS_TABLE)
        .where({ flow_id: PRIMARY_FLOW_ID })
        .whereNull('deleted_at')
        .first('id');

    if (!existingPrimaryFlowStep) {
        await knex(WS_REST_WORKFLOW_STEPS_TABLE).insert(workflowStep).onConflict('id').ignore();
    }
}
