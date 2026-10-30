const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';

const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const PRIMARY_FLOW_ID = '4f7f9d13-65b9-445d-a839-d8e0ece2ed03';
const CONDITIONAL_STEP_ID = '39a92866-2f71-4407-8e4f-ffd92ab48d61';
const CONDITIONAL_ID = 'b823062a-8944-456c-8de1-1c7a42c2adda';
const DUPLICATE_CREATE_CONNECTION_STEP_ID = '4fb9911e-d208-46ef-954f-f533d7220bae';
const CREATE_CONNECTION_ENDPOINT_ID = '22d39ff5-7b42-46b3-93b6-b78c193863ce';

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const conditionalStep = await knex(WS_REST_WORKFLOW_STEPS_TABLE)
        .where({
            id: CONDITIONAL_STEP_ID,
            flow_id: PRIMARY_FLOW_ID,
            conditional_id: CONDITIONAL_ID,
        })
        .whereNull('deleted_at')
        .first('id');

    if (!conditionalStep) {
        return;
    }

    await knex(WS_REST_WORKFLOW_STEPS_TABLE)
        .where({
            id: DUPLICATE_CREATE_CONNECTION_STEP_ID,
            flow_id: PRIMARY_FLOW_ID,
            endpoint_id: CREATE_CONNECTION_ENDPOINT_ID,
        })
        .whereNull('deleted_at')
        .update({
            deleted_at: new Date(),
            deleted_by: SYSTEM_USER_ID,
        });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex(WS_REST_WORKFLOW_STEPS_TABLE)
        .where({
            id: DUPLICATE_CREATE_CONNECTION_STEP_ID,
            flow_id: PRIMARY_FLOW_ID,
            endpoint_id: CREATE_CONNECTION_ENDPOINT_ID,
            deleted_by: SYSTEM_USER_ID,
        })
        .whereNotNull('deleted_at')
        .update({
            deleted_at: null,
            deleted_by: null,
        });
}
