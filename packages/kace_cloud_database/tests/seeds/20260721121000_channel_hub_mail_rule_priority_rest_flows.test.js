import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seed } from '../../seeds/20260721121000_channel_hub_mail_rule_priority_rest_flows.js';

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

const rowsFor = (knex, table) => knex.calls.filter((call) => call.table === table).map((call) => call.payload);

test('seeds getMailRuleByConnection as an idempotent primary RestFlow', async () => {
    const knex = createKnexRecorder();

    await seed(knex);

    const endpoint = rowsFor(knex, 'ws_rest_endpoints').find(
        (row) => row.description === 'Channel Hub - Listar reglas de correo'
    );
    const flow = rowsFor(knex, 'ws_rest_flows').find((row) => row.external_code === 'channelhub-mail-rules-list');
    const step = rowsFor(knex, 'ws_rest_workflow_steps').find((row) => row.flow_id === flow.id);

    assert.equal(endpoint.method, 'GET');
    assert.equal(
        endpoint.url,
        'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule/context.channel_hub_mail_rules.connectionId'
    );
    assert.deepEqual(JSON.parse(endpoint.body), { body: {} });
    assert.deepEqual(JSON.parse(endpoint.headers), {
        headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' },
    });
    assert.equal(endpoint.authorization_id, '06cf3374-f17b-4109-8d37-b16584f91a73');
    assert.equal(endpoint.context_position, 'channel_hub_mail_rules.list_response');
    assert.deepEqual(JSON.parse(endpoint.filter_input), { filter_input: [] });

    assert.equal(flow.is_primary, true);
    assert.equal(flow.is_active, true);
    assert.equal(step.order, 1);
    assert.equal(step.endpoint_id, endpoint.id);

    for (const call of knex.calls) {
        assert.equal(call.conflictColumn, 'id');
        assert.ok(call.mergePayload);
        assert.equal(Object.hasOwn(call.mergePayload, 'id'), false);
        assert.equal(Object.hasOwn(call.mergePayload, 'created_at'), false);
        assert.equal(Object.hasOwn(call.mergePayload, 'created_by'), false);
        assert.equal(call.mergePayload.deleted_at, null);
        assert.equal(call.mergePayload.deleted_by, null);
    }
});

test('seeds updateMailRuleByConnection with a priority-only PATCH body', async () => {
    const knex = createKnexRecorder();

    await seed(knex);

    const endpoint = rowsFor(knex, 'ws_rest_endpoints').find(
        (row) => row.description === 'Channel Hub - Actualizar prioridad de regla de correo'
    );
    const flow = rowsFor(knex, 'ws_rest_flows').find(
        (row) => row.external_code === 'channelhub-mail-rule-priority-update'
    );
    const step = rowsFor(knex, 'ws_rest_workflow_steps').find((row) => row.flow_id === flow.id);

    assert.equal(endpoint.method, 'PATCH');
    assert.equal(
        endpoint.url,
        'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule/context.channel_hub_mail_rules.connectionId/context.channel_hub_mail_rules.ruleId'
    );
    assert.deepEqual(JSON.parse(endpoint.body), {
        body: { priority: 'context.channel_hub_mail_rules.priority' },
    });
    assert.deepEqual(Object.keys(JSON.parse(endpoint.body).body), ['priority']);
    assert.equal(endpoint.context_position, 'channel_hub_mail_rules.update_response');
    assert.equal(endpoint.authorization_id, '06cf3374-f17b-4109-8d37-b16584f91a73');

    assert.equal(flow.is_primary, true);
    assert.equal(flow.is_active, true);
    assert.equal(step.order, 1);
    assert.equal(step.endpoint_id, endpoint.id);
});
