import { jest } from '@jest/globals';
import { ChannelHubMailRulesRestFlowAdapter } from '../../src/channel-hub-workspace-priorities/infrastructure/ChannelHubMailRulesRestFlowAdapter.js';

const LIST_FLOW_ID = '11111111-1111-4111-8111-111111111111';
const UPDATE_FLOW_ID = '22222222-2222-4222-8222-222222222222';
const CONNECTION_ID = 'connection-1234567';

const account = {
    mail_rule_list_rest_flow_id: { value: LIST_FLOW_ID },
    mail_rule_priority_update_rest_flow_id: { value: UPDATE_FLOW_ID },
    channel_hub_connection_id: { value: CONNECTION_ID },
};

const rule = {
    id: 'rule-support',
    connectionId: CONNECTION_ID,
    actionRules: { classifyAs: 'support' },
    priority: 1,
};

const workflowResponse = (channelHubMailRules) => ({
    toJson: () => ({
        data: {
            context: { channel_hub_mail_rules: channelHubMailRules },
        },
    }),
});

describe('ChannelHubMailRulesRestFlowAdapter', () => {
    it('resolves a fresh deadline-bound workflow executor for every remote call', async () => {
        const workflowExecutor = {
            execute: jest.fn().mockResolvedValue(workflowResponse({ list_response: [rule] })),
        };
        const executorFactory = jest.fn().mockReturnValue(workflowExecutor);
        const adapter = new ChannelHubMailRulesRestFlowAdapter(executorFactory);

        await adapter.listRules(account);
        await adapter.listRules(account);

        expect(executorFactory).toHaveBeenCalledTimes(2);
    });

    it('lists mail rules through the configured RestFlow context', async () => {
        const workflowExecutor = {
            execute: jest.fn().mockResolvedValue(workflowResponse({ list_response: [rule] })),
        };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        const result = await adapter.listRules(account);

        expect(workflowExecutor.execute).toHaveBeenCalledWith({
            flow_id: LIST_FLOW_ID,
            initial_context: {
                channel_hub_mail_rules: { connectionId: CONNECTION_ID },
            },
        });
        expect(result).toEqual([rule]);
    });

    it('classifies a rejected Channel Hub connection as an actionable integration failure', async () => {
        const workflowExecutor = {
            execute: jest.fn().mockResolvedValue(
                workflowResponse({
                    list_response: {
                        type: 'urn:problem:bad-request',
                        title: 'Bad Request',
                        detail: 'connection entity not exists or the user is not authorized',
                        status: 400,
                    },
                })
            ),
        };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        await expect(adapter.listRules(account)).rejects.toMatchObject({
            name: 'ChannelHubMailRulesRestFlowError',
            message: 'Channel Hub connection could not be found or accessed',
            statusCode: 502,
            upstreamStatus: 400,
            publicErrorCode: '0x060001',
        });
    });

    it('keeps unrelated Channel Hub bad-request problems as generic integration failures', async () => {
        const workflowExecutor = {
            execute: jest.fn().mockResolvedValue(
                workflowResponse({
                    list_response: {
                        type: 'urn:problem:bad-request',
                        title: 'Bad Request',
                        detail: 'request field is invalid',
                        status: 400,
                    },
                })
            ),
        };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        await expect(adapter.listRules(account)).rejects.toMatchObject({
            name: 'ChannelHubMailRulesRestFlowError',
            message: 'Channel Hub did not return a valid mail-rule list',
            statusCode: 502,
            upstreamStatus: 400,
            publicErrorCode: null,
        });
    });

    it('updates only the requested rule priority through the configured RestFlow context', async () => {
        const updatedRule = { ...rule, priority: 2 };
        const workflowExecutor = {
            execute: jest.fn().mockResolvedValue(workflowResponse({ update_response: updatedRule })),
        };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        const result = await adapter.updatePriority(account, 'rule-support', 2);

        expect(workflowExecutor.execute).toHaveBeenCalledWith({
            flow_id: UPDATE_FLOW_ID,
            initial_context: {
                channel_hub_mail_rules: {
                    connectionId: CONNECTION_ID,
                    ruleId: 'rule-support',
                    priority: 2,
                },
            },
        });
        expect(result).toEqual(updatedRule);
    });

    it('rejects a mail-rule list that does not satisfy the fields needed by the OpenAPI contract', async () => {
        const workflowExecutor = {
            execute: jest.fn().mockResolvedValue(workflowResponse({ list_response: [{ ...rule, priority: 'first' }] })),
        };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        await expect(adapter.listRules(account)).rejects.toMatchObject({
            name: 'ChannelHubMailRulesRestFlowError',
            message: 'Channel Hub returned an invalid mail rule at index 0',
            statusCode: 502,
        });
    });

    it('rejects a mail-rule list returned for a different Channel Hub connection', async () => {
        const workflowExecutor = {
            execute: jest
                .fn()
                .mockResolvedValue(
                    workflowResponse({ list_response: [{ ...rule, connectionId: 'different-connection' }] })
                ),
        };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        await expect(adapter.listRules(account)).rejects.toMatchObject({
            name: 'ChannelHubMailRulesRestFlowError',
            message: 'Channel Hub returned a mail rule for a different connection at index 0',
            statusCode: 502,
        });
    });

    it('rejects an update response for a different rule or priority', async () => {
        const workflowExecutor = {
            execute: jest
                .fn()
                .mockResolvedValue(
                    workflowResponse({ update_response: { ...rule, id: 'different-rule', priority: 2 } })
                ),
        };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        await expect(adapter.updatePriority(account, 'rule-support', 2)).rejects.toMatchObject({
            name: 'ChannelHubMailRulesRestFlowError',
            message: 'Channel Hub returned a different rule or priority after the update',
            statusCode: 502,
        });
    });

    it('rejects an updated mail rule returned for a different Channel Hub connection', async () => {
        const workflowExecutor = {
            execute: jest.fn().mockResolvedValue(
                workflowResponse({
                    update_response: { ...rule, connectionId: 'different-connection', priority: 2 },
                })
            ),
        };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        await expect(adapter.updatePriority(account, 'rule-support', 2)).rejects.toMatchObject({
            name: 'ChannelHubMailRulesRestFlowError',
            message: 'Channel Hub returned an updated mail rule for a different connection',
            statusCode: 502,
        });
    });

    it('translates RestFlow execution failures at the external seam', async () => {
        const executionError = new Error('request timed out');
        const workflowExecutor = { execute: jest.fn().mockRejectedValue(executionError) };
        const adapter = new ChannelHubMailRulesRestFlowAdapter(workflowExecutor);

        await expect(adapter.listRules(account)).rejects.toMatchObject({
            name: 'ChannelHubMailRulesRestFlowError',
            message: 'Unable to list Channel Hub mail rules',
            statusCode: 502,
            cause: executionError,
        });
    });
});
