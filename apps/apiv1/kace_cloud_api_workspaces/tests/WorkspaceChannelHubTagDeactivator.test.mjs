import { jest } from '@jest/globals';
import {
    WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
    WORKSPACE_CHANNEL_HUB_TAG_DELETION_FLOW_REQUIRED,
} from '@kace/error-codes';
import { WorkspaceChannelHubTagDeactivator } from '../src/WorkspaceChannelHubTagDeactivator.mjs';

const workspace = {
    id: 'workspace-id',
    tag: 'support',
    is_active: true,
    tag_deletion_flow_id: 'deletion-flow-id',
    rules: {
        ruleName: 'Support',
        subjectContains: ['help'],
        ruleId: 'legacy-rule-id',
    },
    channel_hub_accounts: [
        {
            id: 'account-1',
            channel_hub_connection_id: 'connection-1',
            channel_hub_rule_id: 'rule-1',
        },
        {
            id: 'account-2',
            channel_hub_connection_id: 'connection-2',
            channel_hub_rule_id: 'rule-2',
        },
    ],
};

const workflowResponse = (
    { connectionId, ruleId },
    deleteResponse = { message: 'Mail rule deleted successfully' }
) => ({
    toJson: () => ({
        data: {
            context: {
                channel_hub_tag: {
                    connectionId,
                    ruleId,
                    delete_response: deleteResponse,
                },
            },
        },
    }),
});

const successfulExecution = ({ initial_context: { channel_hub_tag: target } }) =>
    Promise.resolve(workflowResponse(target));

const createService = (execute = jest.fn(successfulExecution)) => ({
    execute,
    service: new WorkspaceChannelHubTagDeactivator({
        workflowExecutor: { execute },
        metadata: { tenant_id: 'tenant-id', user_id: 'user-id' },
        kaceApiBaseUrl: 'https://kace.example.test/',
        logger: { error: jest.fn() },
    }),
});

describe('WorkspaceChannelHubTagDeactivator', () => {
    it('synchronously deletes every registered rule using the previous workspace snapshot', async () => {
        const { service, execute } = createService();

        await expect(service.execute(workspace)).resolves.toEqual([
            {
                channel_hub_account_id: 'account-1',
                connectionId: 'connection-1',
                ruleId: 'rule-1',
                already_absent: false,
            },
            {
                channel_hub_account_id: 'account-2',
                connectionId: 'connection-2',
                ruleId: 'rule-2',
                already_absent: false,
            },
        ]);
        expect(execute).toHaveBeenCalledTimes(2);
        expect(execute).toHaveBeenNthCalledWith(1, {
            flow_id: 'deletion-flow-id',
            initial_context: {
                source: 'workspaces.deactivate',
                tenant_id: 'tenant-id',
                kace_api_base_url: 'https://kace.example.test',
                workspace,
                channel_hub_tag: expect.objectContaining({
                    connectionId: 'connection-1',
                    ruleId: 'rule-1',
                }),
            },
        });
        expect(execute).toHaveBeenNthCalledWith(2, {
            flow_id: 'deletion-flow-id',
            initial_context: expect.objectContaining({
                workspace,
                channel_hub_tag: expect.objectContaining({
                    connectionId: 'connection-2',
                    ruleId: 'rule-2',
                }),
            }),
        });
    });

    it('treats a remote 404 as idempotent success', async () => {
        const execute = jest
            .fn()
            .mockRejectedValueOnce({ statusCode: 404, fields: { method: 'DELETE' } })
            .mockImplementationOnce(successfulExecution);
        const { service } = createService(execute);

        const result = await service.execute(workspace);

        expect(result[0].already_absent).toBe(true);
        expect(result[1].already_absent).toBe(false);
        expect(execute).toHaveBeenCalledTimes(2);
    });

    it('treats the exact target-attributed provider absent detail as idempotent success', async () => {
        const execute = jest.fn().mockResolvedValue({
            toJson: () => ({
                data: {
                    context: {
                        channel_hub_tag: {
                            connectionId: 'connection-1',
                            ruleId: 'rule-1',
                            delete_response: {
                                status: 400,
                                detail: 'No mail rule found for connectionId connection-1 and ruleId rule-1',
                            },
                        },
                    },
                },
            }),
        });
        const { service } = createService(execute);

        await expect(
            service.execute({ ...workspace, channel_hub_accounts: [workspace.channel_hub_accounts[0]] })
        ).resolves.toEqual([expect.objectContaining({ already_absent: true })]);
    });

    it('rejects the absent detail when the provider status is missing', async () => {
        const target = workspace.channel_hub_accounts[0];
        const responseTarget = { connectionId: target.channel_hub_connection_id, ruleId: target.channel_hub_rule_id };
        const execute = jest.fn().mockResolvedValue(
            workflowResponse(responseTarget, {
                detail: 'No mail rule found for connectionId connection-1 and ruleId rule-1',
            })
        );
        const { service } = createService(execute);

        await expect(service.execute({ ...workspace, channel_hub_accounts: [target] })).rejects.toMatchObject({
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
    });

    it('rejects an absent detail attributed to a different target', async () => {
        const target = workspace.channel_hub_accounts[0];
        const responseTarget = { connectionId: target.channel_hub_connection_id, ruleId: target.channel_hub_rule_id };
        const execute = jest.fn().mockResolvedValue(
            workflowResponse(responseTarget, {
                detail: 'No mail rule found for connectionId connection-2 and ruleId rule-1',
            })
        );
        const { service } = createService(execute);

        await expect(service.execute({ ...workspace, channel_hub_accounts: [target] })).rejects.toMatchObject({
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
    });

    it('retries unexpected resolved upstream bodies and accepts only the exact success message', async () => {
        const target = workspace.channel_hub_accounts[0];
        const responseTarget = { connectionId: target.channel_hub_connection_id, ruleId: target.channel_hub_rule_id };
        const execute = jest
            .fn()
            .mockResolvedValueOnce(workflowResponse(responseTarget, { status: 503, detail: 'upstream unavailable' }))
            .mockResolvedValueOnce(workflowResponse(responseTarget));
        const { service } = createService(execute);

        await expect(service.execute({ ...workspace, channel_hub_accounts: [target] })).resolves.toEqual([
            expect.objectContaining({ already_absent: false }),
        ]);
        expect(execute).toHaveBeenCalledTimes(2);
    });

    it('does not retry an unrelated resolved provider 400', async () => {
        const target = workspace.channel_hub_accounts[0];
        const responseTarget = { connectionId: target.channel_hub_connection_id, ruleId: target.channel_hub_rule_id };
        const execute = jest
            .fn()
            .mockResolvedValue(workflowResponse(responseTarget, { status: 400, detail: 'invalid request' }));
        const { service } = createService(execute);

        await expect(service.execute({ ...workspace, channel_hub_accounts: [target] })).rejects.toMatchObject({
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('rejects a resolved workflow response for a different Channel Hub rule', async () => {
        const execute = jest.fn().mockResolvedValue({
            toJson: () => ({
                data: {
                    context: {
                        channel_hub_tag: {
                            connectionId: 'different-connection',
                            ruleId: 'rule-1',
                            delete_response: {},
                        },
                    },
                },
            }),
        });
        const { service } = createService(execute);

        await expect(
            service.execute({ ...workspace, channel_hub_accounts: [workspace.channel_hub_accounts[0]] })
        ).rejects.toMatchObject({
            name: 'WorkspaceChannelHubTagDeactivatorError',
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('rejects provider response identifiers that do not match the requested rule', async () => {
        const execute = jest.fn().mockResolvedValue({
            toJson: () => ({
                data: {
                    context: {
                        channel_hub_tag: {
                            connectionId: 'connection-1',
                            ruleId: 'rule-1',
                            delete_response: {
                                connection_id: 'different-connection',
                                rule_id: 'rule-1',
                                message: 'Mail rule deleted successfully',
                            },
                        },
                    },
                },
            }),
        });
        const { service } = createService(execute);

        await expect(
            service.execute({ ...workspace, channel_hub_accounts: [workspace.channel_hub_accounts[0]] })
        ).rejects.toMatchObject({
            name: 'WorkspaceChannelHubTagDeactivatorError',
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('retries independent deletions and safely resumes after partial success', async () => {
        const execute = jest
            .fn()
            .mockImplementationOnce(successfulExecution)
            .mockRejectedValueOnce(Object.assign(new Error('temporary failure'), { statusCode: 503 }))
            .mockRejectedValueOnce(Object.assign(new Error('temporary failure'), { statusCode: 503 }))
            .mockRejectedValueOnce(Object.assign(new Error('temporary failure'), { statusCode: 503 }))
            .mockRejectedValueOnce({ statusCode: 404, fields: { method: 'DELETE' } })
            .mockImplementationOnce(successfulExecution);
        const service = new WorkspaceChannelHubTagDeactivator({
            workflowExecutor: { execute },
            metadata: { tenant_id: 'tenant-id', user_id: 'user-id' },
            kaceApiBaseUrl: 'https://kace.example.test/',
            logger: { error: jest.fn() },
            retryDelayMs: 0,
        });

        await expect(service.execute(workspace)).rejects.toMatchObject({
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
        await expect(service.execute(workspace)).resolves.toEqual([
            expect.objectContaining({ channel_hub_account_id: 'account-1', already_absent: true }),
            expect.objectContaining({ channel_hub_account_id: 'account-2', already_absent: false }),
        ]);

        expect(execute).toHaveBeenCalledTimes(6);
    });

    it('starts independent account deletions with bounded concurrency', async () => {
        const starts = [];
        const releases = [];
        const execute = jest.fn(({ initial_context: { channel_hub_tag: tag } }) => {
            starts.push(tag.connectionId);
            return new Promise((resolve) => releases.push(() => resolve(workflowResponse(tag))));
        });
        const service = new WorkspaceChannelHubTagDeactivator({
            workflowExecutor: { execute },
            metadata: { tenant_id: 'tenant-id', user_id: 'user-id' },
            maxConcurrency: 2,
        });

        const deletion = service.execute(workspace);
        await Promise.resolve();
        expect(starts).toEqual(['connection-1', 'connection-2']);
        releases.forEach((release) => release());

        await expect(deletion).resolves.toHaveLength(2);
    });

    it('waits for in-flight deletions to settle before reporting a concurrent failure', async () => {
        let releaseSecond;
        const execute = jest
            .fn()
            .mockRejectedValueOnce(Object.assign(new Error('invalid request'), { statusCode: 400 }))
            .mockImplementationOnce(
                ({ initial_context: { channel_hub_tag: tag } }) =>
                    new Promise((resolve) => {
                        releaseSecond = () => resolve(workflowResponse(tag));
                    })
            );
        const service = new WorkspaceChannelHubTagDeactivator({
            workflowExecutor: { execute },
            maxConcurrency: 2,
            logger: { error: jest.fn() },
        });

        let rejectionObserved = false;
        const deletion = service.execute(workspace).catch((error) => {
            rejectionObserved = true;
            throw error;
        });
        await new Promise((resolve) => setImmediate(resolve));
        expect(rejectionObserved).toBe(false);

        releaseSecond();
        await expect(deletion).rejects.toMatchObject({
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
    });

    it('fails within the total request budget when a remote deletion never settles', async () => {
        const service = new WorkspaceChannelHubTagDeactivator({
            workflowExecutor: { execute: jest.fn(() => new Promise(() => {})) },
            deadlineMs: 10,
            logger: { error: jest.fn() },
        });

        await expect(
            service.execute({ ...workspace, channel_hub_accounts: [workspace.channel_hub_accounts[0]] })
        ).rejects.toMatchObject({
            statusCode: 502,
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
    });

    it('shares the remaining deactivation budget between authorization and deletion requests', async () => {
        let nowMs = 0;
        const requestTimeouts = [];
        const workflowExecutorFactory = jest.fn(({ requestTimeoutResolver }) => ({
            execute: jest.fn(async ({ initial_context: { channel_hub_tag: target } }) => {
                requestTimeouts.push(requestTimeoutResolver());
                nowMs = 10_000;
                requestTimeouts.push(requestTimeoutResolver());
                return workflowResponse(target);
            }),
        }));
        const service = new WorkspaceChannelHubTagDeactivator({
            workflowExecutorFactory,
            deadlineMs: 14_000,
            retryDelayMs: 0,
            now: () => nowMs,
            logger: { error: jest.fn() },
        });

        await expect(
            service.execute({ ...workspace, channel_hub_accounts: [workspace.channel_hub_accounts[0]] })
        ).resolves.toHaveLength(1);

        expect(requestTimeouts).toEqual([10_000, 4_000]);
    });

    it('does not start deletion when authorization exhausts the shared budget', async () => {
        let nowMs = 0;
        let deleteStarted = false;
        const workflowExecutorFactory = jest.fn(({ requestTimeoutResolver }) => ({
            execute: jest.fn(async () => {
                nowMs += requestTimeoutResolver();
                requestTimeoutResolver();
                deleteStarted = true;
            }),
        }));
        const service = new WorkspaceChannelHubTagDeactivator({
            workflowExecutorFactory,
            deadlineMs: 10_000,
            maxConcurrency: 1,
            now: () => nowMs,
            logger: { error: jest.fn() },
        });

        await expect(
            service.execute({ ...workspace, channel_hub_accounts: [workspace.channel_hub_accounts[0]] })
        ).rejects.toMatchObject({
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
        expect(deleteStarted).toBe(false);
        expect(workflowExecutorFactory).toHaveBeenCalledTimes(1);
    });

    it('does not start another remote request after the shared deadline is exhausted', async () => {
        let nowMs = 0;
        const workflowExecutorFactory = jest.fn(() => ({
            execute: jest.fn(async ({ initial_context: { channel_hub_tag: target } }) => {
                nowMs = 10;
                return workflowResponse(target);
            }),
        }));
        const service = new WorkspaceChannelHubTagDeactivator({
            workflowExecutorFactory,
            deadlineMs: 10,
            maxConcurrency: 1,
            now: () => nowMs,
            logger: { error: jest.fn() },
        });

        await expect(service.execute(workspace)).rejects.toMatchObject({
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
        expect(workflowExecutorFactory).toHaveBeenCalledTimes(1);
    });

    it('does not mistake a non-DELETE 404 for an already absent rule', async () => {
        const { service } = createService(jest.fn().mockRejectedValue({ statusCode: 404, fields: { method: 'POST' } }));

        await expect(service.execute(workspace)).rejects.toMatchObject({
            name: 'WorkspaceChannelHubTagDeactivatorError',
            statusCode: 502,
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
    });

    it('fails safely when any remote deletion fails', async () => {
        const execute = jest.fn().mockRejectedValue(new Error('upstream unavailable'));
        const { service } = createService(execute);

        await expect(service.execute(workspace)).rejects.toMatchObject({
            name: 'WorkspaceChannelHubTagDeactivatorError',
            statusCode: 502,
            message: 'Channel Hub rule deletion failed; workspace remains active',
            publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
        });
    });

    it('requires a deletion flow when registered targets exist', async () => {
        const { service, execute } = createService();

        await expect(service.execute({ ...workspace, tag_deletion_flow_id: null })).rejects.toEqual(
            expect.objectContaining({
                name: 'WorkspaceChannelHubTagDeactivatorError',
                statusCode: 409,
                publicErrorCode: WORKSPACE_CHANNEL_HUB_TAG_DELETION_FLOW_REQUIRED,
            })
        );
        expect(execute).not.toHaveBeenCalled();
    });

    it('does nothing when the workspace has no registered targets', async () => {
        const { service, execute } = createService();

        await expect(
            service.execute({
                ...workspace,
                rules: {},
                channel_hub_accounts: workspace.channel_hub_accounts.map((account) => ({
                    ...account,
                    channel_hub_rule_id: null,
                })),
            })
        ).resolves.toEqual([]);
        expect(execute).not.toHaveBeenCalled();
    });
});
