import { describe, expect, it, jest } from '@jest/globals';
import { WorkspaceDeactivationApplication } from '@kace/core/src/workspaces/application/update/WorkspaceDeactivationApplication.js';
import { Workspaces } from '@kace/core/src/workspaces/domain/Workspaces.js';
import { createWorkspaceDeactivationApplication } from '../src/createWorkspaceDeactivationApplication.mjs';

const WORKSPACE_ID = '95346f17-4ee8-420d-a0af-16d2ac394dd9';
const ACCOUNT_ID = '815f9e22-9468-4aac-87a5-38ee1d14ccbd';
const USER_ID = '8c117e69-ae53-47f4-aee4-1ef7ce00ba20';
const DELETION_FLOW_ID = '295d91f9-c3ae-42aa-b919-bdd5620c452e';

const workspaceSnapshot = {
    id: WORKSPACE_ID,
    description: 'Support',
    is_active: true,
    tag: 'support',
    rules: { ruleId: 'rule-1', ruleName: 'Support' },
    mails_accounts: [],
    channel_hub_accounts: [
        {
            id: ACCOUNT_ID,
            channel_hub_connection_id: 'connection-1',
            channel_hub_rule_id: 'rule-1',
        },
    ],
    groups: [],
    tag_creation_flow_id: null,
    tag_update_flow_id: null,
    tag_deletion_flow_id: DELETION_FLOW_ID,
    created_by: USER_ID,
    created_at: '2026-08-19T12:00:00.000Z',
};

const successfulWorkflowResponse = ({ connectionId, ruleId }) => ({
    toJson: () => ({
        data: {
            context: {
                channel_hub_tag: {
                    connectionId,
                    ruleId,
                    delete_response: { message: 'Mail rule deleted successfully' },
                },
            },
        },
    }),
});

describe('createWorkspaceDeactivationApplication', () => {
    it('composes the Core use case with remote and local workspace adapters', async () => {
        const events = [];
        const aggregate = new Workspaces(workspaceSnapshot);
        const workspaceRepository = {
            find: async () => aggregate,
            countNonDeletedChannelHubAccounts: async () => 1,
            deactivate: async (workspace) => events.push({ action: 'local-deactivate', workspace }),
        };
        const workflowExecutorFactory = jest.fn(() => ({
            execute: async (request) => {
                events.push({ action: 'remote-delete', request });
                return successfulWorkflowResponse(request.initial_context.channel_hub_tag);
            },
        }));
        const application = await createWorkspaceDeactivationApplication({
            workspaceRepository,
            workflowExecutorFactory,
            metadata: { tenant_id: 'tenant-1', user_id: USER_ID },
            kaceApiBaseUrl: 'https://api.example.com/',
            logger: { error: jest.fn() },
        });

        expect(application).toBeInstanceOf(WorkspaceDeactivationApplication);
        await expect(
            application.execute(
                WORKSPACE_ID,
                {
                    is_active: false,
                    updated_by: USER_ID,
                    updated_at: '2026-08-19T12:30:00.000Z',
                },
                workspaceSnapshot
            )
        ).resolves.toBe(true);

        expect(events.map(({ action }) => action)).toEqual(['remote-delete', 'local-deactivate']);
        expect(workflowExecutorFactory).toHaveBeenCalledWith({
            requestTimeoutMs: 10_000,
            requestTimeoutResolver: expect.any(Function),
        });
        expect(events[0].request).toMatchObject({
            flow_id: DELETION_FLOW_ID,
            initial_context: {
                source: 'workspaces.deactivate',
                tenant_id: 'tenant-1',
                kace_api_base_url: 'https://api.example.com',
                workspace: workspaceSnapshot,
                channel_hub_tag: {
                    connectionId: 'connection-1',
                    ruleId: 'rule-1',
                    ruleName: 'Support',
                },
            },
        });
        expect(aggregate.is_active.value).toBe(false);
        expect(aggregate.rules.value).toEqual({ ruleName: 'Support' });
    });

    it('keeps the workspace active after partial remote success and completes safely on retry', async () => {
        const secondAccount = {
            id: '91b8ec57-737c-426e-86fd-c2648c9fbf83',
            channel_hub_connection_id: 'connection-2',
            channel_hub_rule_id: 'rule-2',
        };
        const previousSnapshot = {
            ...workspaceSnapshot,
            channel_hub_accounts: [...workspaceSnapshot.channel_hub_accounts, secondAccount],
        };
        const aggregate = new Workspaces(previousSnapshot);
        const deactivate = jest.fn();
        const workspaceRepository = {
            find: async () => aggregate,
            countNonDeletedChannelHubAccounts: async () => 2,
            deactivate: async (workspace) => {
                deactivate(workspace);
            },
        };
        const execute = jest
            .fn()
            .mockResolvedValueOnce(successfulWorkflowResponse({ connectionId: 'connection-1', ruleId: 'rule-1' }))
            .mockRejectedValueOnce(Object.assign(new Error('temporary failure'), { statusCode: 503 }))
            .mockRejectedValueOnce(Object.assign(new Error('temporary failure'), { statusCode: 503 }))
            .mockRejectedValueOnce(Object.assign(new Error('temporary failure'), { statusCode: 503 }))
            .mockRejectedValueOnce({ statusCode: 404, fields: { method: 'DELETE' } })
            .mockResolvedValueOnce(successfulWorkflowResponse({ connectionId: 'connection-2', ruleId: 'rule-2' }));
        const application = await createWorkspaceDeactivationApplication({
            workspaceRepository,
            workflowExecutor: { execute },
            metadata: { tenant_id: 'tenant-1', user_id: USER_ID },
            kaceApiBaseUrl: 'https://api.example.com/',
            logger: { error: jest.fn() },
        });

        await expect(application.execute(WORKSPACE_ID, { is_active: false }, previousSnapshot)).rejects.toThrow(
            'workspace remains active'
        );
        expect(aggregate.is_active.value).toBe(true);
        expect(deactivate).not.toHaveBeenCalled();

        await expect(application.execute(WORKSPACE_ID, { is_active: false }, previousSnapshot)).resolves.toBe(true);
        expect(aggregate.is_active.value).toBe(false);
        expect(deactivate).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledTimes(6);
    });
});
