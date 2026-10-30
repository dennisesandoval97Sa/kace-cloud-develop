const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';

export const WORKSPACE_RULE_CALLBACK_ENDPOINT_ID = '9d7f3e6f-41d4-48ea-a8f1-8c725c0d7be0';
export const KACE_SERVICE_AUTH_ENDPOINT_ID = 'b62dbe60-3db6-4a98-8884-1fb469a09ace';

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
    }

    await knex(WS_REST_WORKFLOW_STEPS_TABLE).where({ endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).del();
}

async function removeCallbackEndpoint(knex) {
    await knex(WS_REST_ENDPOINTS_TABLE).where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).del();
}

async function removeUnusedKaceServiceAuthEndpoint(knex) {
    const reference = await knex(WS_REST_ENDPOINTS_TABLE)
        .where({ authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID })
        .first('id');

    if (!reference) {
        await knex(WS_REST_ENDPOINTS_TABLE).where({ id: KACE_SERVICE_AUTH_ENDPOINT_ID }).del();
    }
}

export async function up(knex) {
    await removeCallbackSteps(knex);
    await removeCallbackEndpoint(knex);
    await removeUnusedKaceServiceAuthEndpoint(knex);
}

export async function down() {}
