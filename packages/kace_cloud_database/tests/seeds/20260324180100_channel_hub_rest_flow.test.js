import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seed } from '../../seeds/20260324180100_channel_hub_rest_flow.js';

function createKnexRecorder({ existingPrimaryFlowStep = null } = {}) {
    const calls = [];
    const queries = [];

    const knex = (table) => ({
        insert(payload) {
            const call = { table, payload, conflictColumn: undefined, ignored: false };
            calls.push(call);

            return {
                onConflict(column) {
                    call.conflictColumn = column;

                    return {
                        ignore() {
                            call.ignored = true;
                            return Promise.resolve();
                        },
                    };
                },
            };
        },
        where(criteria) {
            const query = { table, criteria, whereNullColumn: undefined, firstColumn: undefined };
            queries.push(query);

            const builder = {
                whereNull(column) {
                    query.whereNullColumn = column;
                    return builder;
                },
                first(column) {
                    query.firstColumn = column;
                    return Promise.resolve(existingPrimaryFlowStep);
                },
            };

            return builder;
        },
    });

    knex.calls = calls;
    knex.queries = queries;
    return knex;
}

test('Channel Hub REST flow seed ignores rows that already exist by id', async () => {
    const knex = createKnexRecorder();

    await seed(knex);

    assert.deepEqual(
        knex.calls.map(({ table, conflictColumn, ignored }) => ({ table, conflictColumn, ignored })),
        [
            { table: 'ws_rest_endpoints', conflictColumn: 'id', ignored: true },
            { table: 'ws_rest_flows', conflictColumn: 'id', ignored: true },
            { table: 'ws_rest_workflow_steps', conflictColumn: 'id', ignored: true },
        ]
    );
});

test('Channel Hub REST flow seed does not add standalone create step when primary flow already has steps', async () => {
    const knex = createKnexRecorder({
        existingPrimaryFlowStep: { id: '39a92866-2f71-4407-8e4f-ffd92ab48d61' },
    });

    await seed(knex);

    assert.deepEqual(knex.queries, [
        {
            table: 'ws_rest_workflow_steps',
            criteria: { flow_id: '4f7f9d13-65b9-445d-a839-d8e0ece2ed03' },
            whereNullColumn: 'deleted_at',
            firstColumn: 'id',
        },
    ]);

    assert.deepEqual(
        knex.calls.map(({ table, conflictColumn, ignored }) => ({ table, conflictColumn, ignored })),
        [
            { table: 'ws_rest_endpoints', conflictColumn: 'id', ignored: true },
            { table: 'ws_rest_flows', conflictColumn: 'id', ignored: true },
        ]
    );
});
