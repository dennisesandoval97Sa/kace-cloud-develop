const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_FLOWS_TABLE = 'ws_rest_flows';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';

const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-05-25 10:00:01.000000 -05:00';
const AUTH_ENDPOINT_ID = '06cf3374-f17b-4109-8d37-b16584f91a73';

const REPLY_ENDPOINT_ID = '880afc61-65d3-445a-a2ba-8c69b51561d6';
const REPLY_FLOW_ID = '8475ae26-eb15-4d63-a269-526ea78b3891';
const REPLY_STEP_ID = 'ad51e582-4938-4a51-934f-1a8258cf815d';

const replyEmailEndpoint = {
    id: REPLY_ENDPOINT_ID,
    type: 'consumption',
    description: 'Channel Hub - Responder email (reply)',
    url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/reply',
    method: 'POST',
    headers: JSON.stringify({
        headers: {
            Authorization: 'Bearer context.channel_hub.auth.access_token',
        },
    }),
    body: JSON.stringify({
        body: {
            connectionId: 'context.channel_hub.connectionId',
            from: 'context.channel_hub.from',
            responseMessageId: 'context.channel_hub.responseMessageId',
            replyMessage: 'context.channel_hub.replyMessage',
            isReplyAll: 'context.channel_hub.isReplyAll',
            cc: 'context.channel_hub.cc',
            bcc: 'context.channel_hub.bcc',
            attachments: 'context.channel_hub.attachments',
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
    authorization_id: AUTH_ENDPOINT_ID,
    is_dynamic_header: true,
    // Vacío a propósito: vuelca la respuesta completa en el contexto para que un rechazo de
    // Channel Hub (problem+json) llegue a EmailReplier con su `detail`. Ver
    // migrations/20260826120000_channel_hub_email_endpoints_full_response_context.js.
    filter_input: JSON.stringify({ filter_input: [] }),
    context_position: 'channel_hub.reply_response',
    on_success: JSON.stringify({ on_success: {} }),
    on_error: JSON.stringify({ on_error: {} }),
    attempts: 0,
    initial_context: JSON.stringify({ initial_context: {} }),
};

const replyEmailFlow = {
    id: REPLY_FLOW_ID,
    description: 'Channel Hub - Responder email (reply)',
    is_active: true,
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: CREATED_AT,
    updated_by: SYSTEM_USER_ID,
    deleted_at: null,
    deleted_by: null,
    external_code: 'channelhub-reply-email',
    json_diagram_properties: JSON.stringify({
        edges: [
            {
                id: 'reactflow__edge-0-reply-email',
                data: { is_visible: true },
                type: 'custom',
                source: '0',
                target: REPLY_ENDPOINT_ID,
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
                id: REPLY_ENDPOINT_ID,
                data: {
                    id: REPLY_ENDPOINT_ID,
                    type: 'endpoint',
                    label: 'Channel Hub - Responder email (reply)',
                },
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
    }),
    is_primary: true,
    initial_context: null,
};

const replyEmailWorkflowStep = {
    id: REPLY_STEP_ID,
    flow_id: REPLY_FLOW_ID,
    order: 1,
    endpoint_id: REPLY_ENDPOINT_ID,
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
    await knex(WS_REST_ENDPOINTS_TABLE).insert(replyEmailEndpoint).onConflict('id').ignore();
    await knex(WS_REST_FLOWS_TABLE).insert(replyEmailFlow).onConflict('id').ignore();
    await knex(WS_REST_WORKFLOW_STEPS_TABLE).insert(replyEmailWorkflowStep).onConflict('id').ignore();
}
