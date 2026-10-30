import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seed } from '../../seeds/20260521180000_channel_hub_tag_rest_flows.js';

function createKnexRecorder() {
    const calls = [];

    const knex = (table) => ({
        insert(payload) {
            const call = { table, payload, conflictColumn: undefined, mergePayload: undefined };
            calls.push(call);

            return {
                onConflict(column) {
                    call.conflictColumn = column;

                    return {
                        merge(payloadToMerge) {
                            call.mergePayload = payloadToMerge;
                            return Promise.resolve();
                        },
                    };
                },
            };
        },
    });

    knex.calls = calls;
    return knex;
}

const callsForTable = (knex, table) => knex.calls.filter((call) => call.table === table);

const findByDescription = (rows, description) => rows.find((row) => row.description === description);

test('Channel Hub tag REST flow seed upserts catalog rows so reruns correct stale definitions', async () => {
    const knex = createKnexRecorder();

    await seed(knex);

    assert.deepEqual(
        knex.calls.map(({ table, conflictColumn, mergePayload }) => ({
            table,
            conflictColumn,
            merged: Boolean(mergePayload),
        })),
        [
            { table: 'ws_rest_functions', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_endpoints', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_endpoints', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_endpoints', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_flows', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_flows', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_flows', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_workflow_steps', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_workflow_steps', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_workflow_steps', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_workflow_steps', conflictColumn: 'id', merged: true },
            { table: 'ws_rest_workflow_steps', conflictColumn: 'id', merged: true },
        ]
    );

    for (const call of knex.calls) {
        assert.equal(call.mergePayload.deleted_at, null);
        assert.equal(call.mergePayload.deleted_by, null);
    }
});

test('Channel Hub tag REST flow seed defines create and update with normalized context-reference bodies', async () => {
    const knex = createKnexRecorder();

    await seed(knex);

    const normalizer = callsForTable(knex, 'ws_rest_functions')[0].payload;
    const endpoints = callsForTable(knex, 'ws_rest_endpoints').map((call) => call.payload);
    const flows = callsForTable(knex, 'ws_rest_flows').map((call) => call.payload);
    const steps = callsForTable(knex, 'ws_rest_workflow_steps').map((call) => call.payload);

    assert.equal(normalizer.description, 'Channel Hub - Normalize email rule body');
    assert.equal(normalizer.type, 'normalizeChannelHubRule');
    assert.deepEqual(JSON.parse(normalizer.filter_input), { filter_input: ['channel_hub_tag'] });
    assert.equal(normalizer.context_position, 'channel_hub_tag_request');

    const createEndpoint = findByDescription(endpoints, 'Channel Hub - Crear Tag (email rule)');
    assert.equal(createEndpoint.id, '5ac4c03c-f840-4fa4-aaea-60734b08a02f');
    assert.equal(createEndpoint.method, 'POST');
    assert.equal(createEndpoint.url, 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule');
    assert.deepEqual(JSON.parse(createEndpoint.body), { body: 'context.channel_hub_tag_request' });
    assert.equal(createEndpoint.context_position, 'channel_hub_tag.response');
    assert.equal(createEndpoint.body_type, 'json');
    assert.equal(createEndpoint.cache_expires_in_path, null);
    assert.equal(createEndpoint.cache_default_ttl_seconds, null);

    const updateEndpoint = findByDescription(endpoints, 'Channel Hub - Actualizar Tag (email rule)');
    assert.equal(updateEndpoint.id, '5a003061-9952-4df2-8372-c6c1b4579091');
    assert.equal(updateEndpoint.method, 'PUT');
    assert.equal(
        updateEndpoint.url,
        'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule/context.channel_hub_tag.connectionId/context.channel_hub_tag.ruleId'
    );
    assert.deepEqual(JSON.parse(updateEndpoint.body), { body: 'context.channel_hub_tag_request' });
    assert.equal(updateEndpoint.context_position, 'channel_hub_tag.response');
    assert.equal(updateEndpoint.body_type, 'json');
    assert.equal(updateEndpoint.cache_expires_in_path, null);
    assert.equal(updateEndpoint.cache_default_ttl_seconds, null);

    const createFlow = findByDescription(flows, 'Channel Hub - Crear tag');
    assert.equal(createFlow.external_code, 'channelhub-tag-create');
    const createFlowSteps = steps.filter((step) => step.flow_id === createFlow.id);
    assert.equal(createFlowSteps[0].order, 1);
    assert.equal(createFlowSteps[0].function_id, normalizer.id);
    assert.equal(createFlowSteps[1].order, 2);
    assert.equal(createFlowSteps[1].endpoint_id, createEndpoint.id);

    const updateFlow = findByDescription(flows, 'Channel Hub - Actualizar tag');
    assert.equal(updateFlow.external_code, 'channelhub-tag-update');
    const updateFlowSteps = steps.filter((step) => step.flow_id === updateFlow.id);
    assert.equal(updateFlowSteps[0].order, 1);
    assert.equal(updateFlowSteps[0].function_id, normalizer.id);
    assert.equal(updateFlowSteps[1].order, 2);
    assert.equal(updateFlowSteps[1].endpoint_id, updateEndpoint.id);
});

test('Channel Hub tag REST flow seed defines delete tag without a request body normalizer', async () => {
    const knex = createKnexRecorder();

    await seed(knex);

    const endpoints = callsForTable(knex, 'ws_rest_endpoints').map((call) => call.payload);
    const flows = callsForTable(knex, 'ws_rest_flows').map((call) => call.payload);
    const steps = callsForTable(knex, 'ws_rest_workflow_steps').map((call) => call.payload);

    const endpoint = findByDescription(endpoints, 'Channel Hub - Eliminar tag (email rule)');
    const flow = findByDescription(flows, 'Channel Hub - Eliminar tag');
    const workflowStep = steps.find((step) => step.flow_id === flow.id);
    const diagram = JSON.parse(flow.json_diagram_properties);

    assert.equal(endpoint.id, '6c1327b4-fdd8-47a9-8477-78aa73703342');
    assert.equal(endpoint.method, 'DELETE');
    assert.equal(
        endpoint.url,
        'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule/context.channel_hub_tag.connectionId/context.channel_hub_tag.ruleId'
    );
    assert.equal(endpoint.authorization_id, '06cf3374-f17b-4109-8d37-b16584f91a73');
    assert.equal(endpoint.context_position, 'channel_hub_tag.delete_response');
    assert.equal(endpoint.body_type, 'json');
    assert.equal(endpoint.cache_expires_in_path, null);
    assert.equal(endpoint.cache_default_ttl_seconds, null);
    assert.deepEqual(JSON.parse(endpoint.headers), {
        headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' },
    });
    assert.deepEqual(JSON.parse(endpoint.body), { body: {} });

    assert.equal(flow.external_code, 'channelhub-tag-delete');
    assert.equal(diagram.edges[0].source, '0');
    assert.equal(diagram.edges[0].target, endpoint.id);
    assert.equal(diagram.nodes[1].id, endpoint.id);
    assert.equal(diagram.nodes[1].data.id, endpoint.id);

    assert.equal(workflowStep.id, 'e2ce7304-e84c-46fa-ba2f-cef98e966a62');
    assert.equal(workflowStep.order, 1);
    assert.equal(workflowStep.endpoint_id, endpoint.id);
    assert.equal(workflowStep.function_id, null);
});
