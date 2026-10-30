import { jest } from '@jest/globals';
import {
    WorkspaceChannelHubTagRegistrar,
    WorkspaceChannelHubTagRegistrarError,
} from '../src/WorkspaceChannelHubTagRegistrar.mjs';

const WORKSPACE_ID = '95346f17-4ee8-420d-a0af-16d2ac394dd9';
const TENANT_ID = '36eadabc-7194-4564-889c-8f5241b6fc70';
const USER_ID = '6bae1fbf-afd4-4bd0-b07e-24ed9dc5a13e';
const CREATE_FLOW_ID = 'd29967a3-8988-4b78-9542-c3c1fe4a992b';
const DELETE_FLOW_ID = '1c0f8fdb-05c4-45b8-9d15-6ea7d24f8727';
const ACCOUNT_ID = '5bef0eb7-6781-4423-806e-d320cc6ed619';
const SECOND_ACCOUNT_ID = '0d70b7b9-6c4a-4436-9b7e-c33b31acbe5a';
const CONNECTION_ID = '3E3R0BE70304do9a0Z6a9mqmTCK';
const SECOND_CONNECTION_ID = '4F4S1CF81415ep1b1A7b0nrnUDL';
const RULE_ID = '3E5FX4NM9SGdWZzz9Ad0ZNGHskf';
const SECOND_RULE_ID = '4F6GY5ON0THeXAaa0Be1AOHItlg';

const workspace = {
    id: WORKSPACE_ID,
    description: 'Support workspace',
    tag: 'support',
    rules: {
        ruleName: 'support-custom',
        subjectContains: ['billing'],
        actionRules: { classifyAs: 'support' },
    },
    channel_hub_accounts: [
        {
            id: ACCOUNT_ID,
            channel_hub_connection_id: CONNECTION_ID,
            channel_hub_rule_id: null,
        },
    ],
    tag_creation_flow_id: CREATE_FLOW_ID,
    tag_deletion_flow_id: DELETE_FLOW_ID,
};

const multiAccountWorkspace = {
    ...workspace,
    channel_hub_accounts: [
        { id: ACCOUNT_ID, channel_hub_connection_id: CONNECTION_ID, channel_hub_rule_id: null },
        { id: SECOND_ACCOUNT_ID, channel_hub_connection_id: SECOND_CONNECTION_ID, channel_hub_rule_id: null },
    ],
};

function createRelationsQueryMock({ relationUpdateResults = {}, relationUpdateErrors = {} } = {}) {
    const query = {
        criteria: null,
        where: jest.fn(function (criteria) {
            query.criteria = criteria;
            return query;
        }),
        whereNull: jest.fn().mockReturnThis(),
        update: jest.fn(function () {
            const accountId = query.criteria?.channel_hub_account_id;
            if (relationUpdateErrors[accountId]) {
                return Promise.reject(relationUpdateErrors[accountId]);
            }
            return Promise.resolve(relationUpdateResults[accountId] ?? 1);
        }),
    };
    return query;
}

const createFlowResponse = ({ ruleId = RULE_ID, connectionId = CONNECTION_ID } = {}) => ({
    toJson: () => ({
        data: {
            context: {
                channel_hub_tag: {
                    response: {
                        id: ruleId,
                        connectionId,
                    },
                },
            },
        },
    }),
});

function createRegistrar({
    workspaceResult = workspace,
    relationUpdateResults = {},
    relationUpdateErrors = {},
    workflowResponses = [createFlowResponse()],
} = {}) {
    const relationsQuery = createRelationsQueryMock({ relationUpdateResults, relationUpdateErrors });
    const workspaceRepository = {
        find: jest.fn().mockResolvedValue(workspaceResult),
        channelHubRelationsTable: 'workspaces_channel_hub_accounts_relations',
        table: jest.fn().mockReturnValue(relationsQuery),
    };
    const workflowExecutor = {
        execute: jest.fn().mockImplementation(() => {
            const next = workflowResponses.shift();
            if (next && next.__reject) return Promise.reject(next.__reject);
            return Promise.resolve(next);
        }),
    };
    const logger = {
        error: jest.fn(),
        warn: jest.fn(),
    };

    const registrar = new WorkspaceChannelHubTagRegistrar({
        workspaceRepository,
        workflowExecutor,
        metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
        currentUser: { id: { value: USER_ID } },
        kaceApiBaseUrl: 'https://correos-api.kace-cloudtest.com/',
        now: () => new Date('2026-05-27T15:00:00.000Z'),
        logger,
    });

    return { registrar, workspaceRepository, workflowExecutor, relationsQuery, logger };
}

describe('WorkspaceChannelHubTagRegistrar', () => {
    it('registers every pending account, executing one create flow per account connection', async () => {
        const { registrar, workflowExecutor, workspaceRepository, relationsQuery } = createRegistrar({
            workspaceResult: multiAccountWorkspace,
            workflowResponses: [
                createFlowResponse({ ruleId: RULE_ID, connectionId: CONNECTION_ID }),
                createFlowResponse({ ruleId: SECOND_RULE_ID, connectionId: SECOND_CONNECTION_ID }),
            ],
        });

        await expect(registrar.execute(WORKSPACE_ID)).resolves.toEqual({
            workspace_id: WORKSPACE_ID,
            registered: [
                { channel_hub_account_id: ACCOUNT_ID, connection_id: CONNECTION_ID, rule_id: RULE_ID },
                {
                    channel_hub_account_id: SECOND_ACCOUNT_ID,
                    connection_id: SECOND_CONNECTION_ID,
                    rule_id: SECOND_RULE_ID,
                },
            ],
            failed: [],
        });

        expect(workflowExecutor.execute).toHaveBeenCalledTimes(2);
        expect(workflowExecutor.execute).toHaveBeenNthCalledWith(1, {
            flow_id: CREATE_FLOW_ID,
            initial_context: expect.objectContaining({
                source: 'workspaces.register_tags',
                tenant_id: TENANT_ID,
                channel_hub_tag: expect.objectContaining({ connectionId: CONNECTION_ID }),
            }),
        });
        expect(workflowExecutor.execute).toHaveBeenNthCalledWith(2, {
            flow_id: CREATE_FLOW_ID,
            initial_context: expect.objectContaining({
                channel_hub_tag: expect.objectContaining({ connectionId: SECOND_CONNECTION_ID }),
            }),
        });

        expect(workspaceRepository.table).toHaveBeenCalledWith('workspaces_channel_hub_accounts_relations');
        expect(relationsQuery.where).toHaveBeenNthCalledWith(1, {
            workspace_id: WORKSPACE_ID,
            channel_hub_account_id: ACCOUNT_ID,
        });
        expect(relationsQuery.where).toHaveBeenNthCalledWith(2, {
            workspace_id: WORKSPACE_ID,
            channel_hub_account_id: SECOND_ACCOUNT_ID,
        });
        expect(relationsQuery.whereNull).toHaveBeenCalledWith('channel_hub_rule_id');
        expect(relationsQuery.update).toHaveBeenNthCalledWith(1, { channel_hub_rule_id: RULE_ID });
        expect(relationsQuery.update).toHaveBeenNthCalledWith(2, { channel_hub_rule_id: SECOND_RULE_ID });
    });

    it('skips accounts that already have a rule id and registers only the pending ones', async () => {
        const { registrar, workflowExecutor } = createRegistrar({
            workspaceResult: {
                ...multiAccountWorkspace,
                channel_hub_accounts: [
                    {
                        id: ACCOUNT_ID,
                        channel_hub_connection_id: CONNECTION_ID,
                        channel_hub_rule_id: 'already-registered-rule',
                    },
                    {
                        id: SECOND_ACCOUNT_ID,
                        channel_hub_connection_id: SECOND_CONNECTION_ID,
                        channel_hub_rule_id: null,
                    },
                ],
            },
            workflowResponses: [createFlowResponse({ ruleId: SECOND_RULE_ID, connectionId: SECOND_CONNECTION_ID })],
        });

        await expect(registrar.execute(WORKSPACE_ID)).resolves.toEqual({
            workspace_id: WORKSPACE_ID,
            registered: [
                {
                    channel_hub_account_id: SECOND_ACCOUNT_ID,
                    connection_id: SECOND_CONNECTION_ID,
                    rule_id: SECOND_RULE_ID,
                },
            ],
            failed: [],
        });
        expect(workflowExecutor.execute).toHaveBeenCalledTimes(1);
    });

    it('rejects with 409 when every usable account is already registered', async () => {
        const { registrar, workflowExecutor } = createRegistrar({
            workspaceResult: {
                ...workspace,
                channel_hub_accounts: [
                    {
                        id: ACCOUNT_ID,
                        channel_hub_connection_id: CONNECTION_ID,
                        channel_hub_rule_id: 'already-registered-rule',
                    },
                ],
            },
        });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            name: 'WorkspaceChannelHubTagRegistrarError',
            statusCode: 409,
            message: 'Workspace already has a Channel Hub rule registered',
        });
        expect(workflowExecutor.execute).not.toHaveBeenCalled();
    });

    it('treats a legacy scalar rules.ruleId with a single account as already registered', async () => {
        const { registrar, workflowExecutor } = createRegistrar({
            workspaceResult: {
                ...workspace,
                rules: { ...workspace.rules, ruleId: 'legacy-rule-id' },
            },
        });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            statusCode: 409,
            message: 'Workspace already has a Channel Hub rule registered',
        });
        expect(workflowExecutor.execute).not.toHaveBeenCalled();
    });

    it('keeps successful registrations and reports per-account failures when one create flow fails', async () => {
        const flowError = new Error('restflow execution failed');
        const { registrar, workflowExecutor, relationsQuery, logger } = createRegistrar({
            workspaceResult: multiAccountWorkspace,
            workflowResponses: [
                createFlowResponse({ ruleId: RULE_ID, connectionId: CONNECTION_ID }),
                { __reject: flowError },
            ],
        });

        await expect(registrar.execute(WORKSPACE_ID)).resolves.toEqual({
            workspace_id: WORKSPACE_ID,
            registered: [{ channel_hub_account_id: ACCOUNT_ID, connection_id: CONNECTION_ID, rule_id: RULE_ID }],
            failed: [
                {
                    channel_hub_account_id: SECOND_ACCOUNT_ID,
                    connection_id: SECOND_CONNECTION_ID,
                    message: 'Create-tag RESTflow execution failed',
                    cleanup_attempted: false,
                    cleanup_succeeded: false,
                },
            ],
        });

        expect(workflowExecutor.execute).toHaveBeenCalledTimes(2);
        expect(relationsQuery.update).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            'Create-tag RESTflow execution failed',
            expect.objectContaining({
                workspace_id: WORKSPACE_ID,
                channel_hub_account_id: SECOND_ACCOUNT_ID,
                error: flowError,
            })
        );
    });

    it('reports a failure without registering when the flow response has no rule id', async () => {
        const { registrar, relationsQuery } = createRegistrar({
            workspaceResult: workspace,
            workflowResponses: [createFlowResponse({ ruleId: '' })],
        });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            name: 'WorkspaceChannelHubTagRegistrarError',
            statusCode: 502,
            message: 'Channel Hub tag registration failed for all pending accounts',
            details: {
                workspace_id: WORKSPACE_ID,
                failed: [
                    expect.objectContaining({
                        channel_hub_account_id: ACCOUNT_ID,
                        message: 'Create-tag RESTflow response did not include a Channel Hub rule id',
                    }),
                ],
            },
        });
        expect(relationsQuery.update).not.toHaveBeenCalled();
    });

    it('throws 502 with per-account details when every pending account fails', async () => {
        const { registrar } = createRegistrar({
            workspaceResult: multiAccountWorkspace,
            workflowResponses: [{ __reject: new Error('boom-1') }, { __reject: new Error('boom-2') }],
        });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            statusCode: 502,
            message: 'Channel Hub tag registration failed for all pending accounts',
            details: {
                workspace_id: WORKSPACE_ID,
                failed: [
                    expect.objectContaining({ channel_hub_account_id: ACCOUNT_ID }),
                    expect.objectContaining({ channel_hub_account_id: SECOND_ACCOUNT_ID }),
                ],
            },
        });
    });

    it('attempts per-account delete-flow compensation when persisting the rule id fails', async () => {
        const { registrar, workflowExecutor, logger } = createRegistrar({
            workspaceResult: multiAccountWorkspace,
            relationUpdateResults: { [ACCOUNT_ID]: 0, [SECOND_ACCOUNT_ID]: 1 },
            workflowResponses: [
                createFlowResponse({ ruleId: RULE_ID, connectionId: CONNECTION_ID }),
                { toJson: () => ({ data: { ok: true } }) },
                createFlowResponse({ ruleId: SECOND_RULE_ID, connectionId: SECOND_CONNECTION_ID }),
            ],
        });

        await expect(registrar.execute(WORKSPACE_ID)).resolves.toEqual({
            workspace_id: WORKSPACE_ID,
            registered: [
                {
                    channel_hub_account_id: SECOND_ACCOUNT_ID,
                    connection_id: SECOND_CONNECTION_ID,
                    rule_id: SECOND_RULE_ID,
                },
            ],
            failed: [
                {
                    channel_hub_account_id: ACCOUNT_ID,
                    connection_id: CONNECTION_ID,
                    message: 'Could not persist Channel Hub rule id',
                    cleanup_attempted: true,
                    cleanup_succeeded: true,
                },
            ],
        });

        expect(workflowExecutor.execute).toHaveBeenNthCalledWith(2, {
            flow_id: DELETE_FLOW_ID,
            initial_context: expect.objectContaining({
                source: 'workspaces.register_tags.rollback',
                channel_hub_tag: expect.objectContaining({
                    connectionId: CONNECTION_ID,
                    ruleId: RULE_ID,
                }),
            }),
        });
        expect(logger.error).toHaveBeenCalledWith(
            'Could not persist Channel Hub rule id after create-tag RESTflow succeeded',
            expect.objectContaining({
                workspace_id: WORKSPACE_ID,
                channel_hub_account_id: ACCOUNT_ID,
                rule_id: RULE_ID,
                cleanup_attempted: true,
                cleanup_succeeded: true,
            })
        );
    });

    it('records cleanup_succeeded false when compensation fails after a persistence error', async () => {
        const { registrar, logger } = createRegistrar({
            workspaceResult: workspace,
            relationUpdateErrors: { [ACCOUNT_ID]: new Error('database write failed') },
            workflowResponses: [createFlowResponse(), { __reject: new Error('delete flow failed') }],
        });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            statusCode: 502,
            details: {
                workspace_id: WORKSPACE_ID,
                failed: [
                    expect.objectContaining({
                        channel_hub_account_id: ACCOUNT_ID,
                        message: 'Could not persist Channel Hub rule id',
                        cleanup_attempted: true,
                        cleanup_succeeded: false,
                    }),
                ],
            },
        });
        expect(logger.error).toHaveBeenCalledWith(
            'Failed to clean up Channel Hub rule after workspace persistence failure',
            expect.objectContaining({
                workspace_id: WORKSPACE_ID,
                rule_id: RULE_ID,
                error: expect.any(Error),
            })
        );
    });

    it('rejects a missing workspace with 404', async () => {
        const { registrar, workflowExecutor } = createRegistrar({ workspaceResult: null });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            name: 'WorkspaceChannelHubTagRegistrarError',
            statusCode: 404,
            message: 'Workspace not found',
        });
        expect(workflowExecutor.execute).not.toHaveBeenCalled();
    });

    it('rejects a missing tag_creation_flow_id with 409 before workflow execution', async () => {
        const { registrar, workflowExecutor } = createRegistrar({
            workspaceResult: { ...workspace, tag_creation_flow_id: null },
        });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            statusCode: 409,
            message: 'Workspace has no tag creation flow assigned',
        });
        expect(workflowExecutor.execute).not.toHaveBeenCalled();
    });

    it('rejects a missing usable Channel Hub connection with 409 before workflow execution', async () => {
        const { registrar, workflowExecutor } = createRegistrar({
            workspaceResult: {
                ...workspace,
                channel_hub_accounts: [{ id: 'account-without-connection', channel_hub_connection_id: ' ' }],
            },
        });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            statusCode: 409,
            message: 'Workspace has no usable Channel Hub account connection',
        });
        expect(workflowExecutor.execute).not.toHaveBeenCalled();
    });

    it('rejects non-object rules with 409 before workflow execution', async () => {
        const { registrar, workflowExecutor } = createRegistrar({
            workspaceResult: {
                ...workspace,
                rules: [{ field: 'subject', operator: 'contains', value: 'support' }],
            },
        });

        await expect(registrar.execute(WORKSPACE_ID)).rejects.toMatchObject({
            statusCode: 409,
            message: 'Workspace rules must be an object to register Channel Hub rule id',
        });
        expect(workflowExecutor.execute).not.toHaveBeenCalled();
    });

    it('parses string rules JSON and builds the create context from them', async () => {
        const { registrar, workflowExecutor } = createRegistrar({
            workspaceResult: {
                ...workspace,
                rules: JSON.stringify({ ...workspace.rules, bodyContains: ['vip'] }),
            },
        });

        await expect(registrar.execute(WORKSPACE_ID)).resolves.toMatchObject({
            workspace_id: WORKSPACE_ID,
            registered: [expect.objectContaining({ rule_id: RULE_ID })],
        });
        expect(workflowExecutor.execute).toHaveBeenCalledWith({
            flow_id: CREATE_FLOW_ID,
            initial_context: expect.objectContaining({
                channel_hub_tag: expect.objectContaining({ bodyContains: ['vip'] }),
            }),
        });
    });

    it('supports repository results that expose a toJson workspace shape', async () => {
        const { registrar } = createRegistrar({
            workspaceResult: {
                toJson: () => ({ data: workspace }),
            },
        });

        await expect(registrar.execute(WORKSPACE_ID)).resolves.toMatchObject({
            workspace_id: WORKSPACE_ID,
            registered: [expect.objectContaining({ rule_id: RULE_ID })],
        });
    });

    it('falls back to the account connection id when the RESTflow response omits connectionId', async () => {
        const { registrar } = createRegistrar({
            workflowResponses: [createFlowResponse({ connectionId: null })],
        });

        await expect(registrar.execute(WORKSPACE_ID)).resolves.toMatchObject({
            registered: [expect.objectContaining({ connection_id: CONNECTION_ID })],
        });
    });

    it('keeps statusCode and details on custom errors', () => {
        const error = new WorkspaceChannelHubTagRegistrarError('custom failure', 418, { field: 'rule_id' });

        expect(error).toBeInstanceOf(Error);
        expect(error).toMatchObject({
            name: 'WorkspaceChannelHubTagRegistrarError',
            message: 'custom failure',
            statusCode: 418,
            details: { field: 'rule_id' },
        });
    });
});
