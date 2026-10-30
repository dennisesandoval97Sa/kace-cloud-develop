import { WSRestFlowExecutionRequested } from '@kace/core/src/ws-rest-flow-executions/domain/events/WSRestFlowExecutionRequested.js';
import { jest } from '@jest/globals';
import {
    WorkspaceTagUpdateFlowQueuer,
    buildChannelHubTagContext,
    channelHubRuleTargets,
    removedChannelHubRuleTargets,
    rulesWithoutRemovedLegacyRuleId,
} from '../src/WorkspaceTagUpdateFlowQueuer.mjs';

const WORKSPACE_ID = '4cecb6b5-69cf-4f93-8c54-c12d206f0efd';
const FLOW_ID = 'd29967a3-8988-4b78-9542-c3c1fe4a992b';
const DELETE_FLOW_ID = '1c0f8fdb-05c4-45b8-9d15-6ea7d24f8727';
const EXECUTION_ID = 'f2cf85ab-6501-4abc-a00f-ec780c7a882f';
const SECOND_EXECUTION_ID = 'a81d96bc-7612-4bcd-b11e-fd891d8b993a';
const USER_ID = '3824c61a-6368-4c5c-957f-769525109e85';
const TENANT_ID = '36eadabc-7194-4564-889c-8f5241b6fc70';

const workspace = {
    id: WORKSPACE_ID,
    description: 'Support workspace',
    tag: 'support',
    rules: {
        ruleId: 'channel-rule-id',
        ruleName: 'support-custom',
        subjectContains: ['billing'],
        subjectEquals: ['ignored by normalizer later'],
        toContains: [],
        bodyEquals: ['urgent'],
        actionRules: {
            classifyAs: 'support',
        },
    },
    channel_hub_accounts: [
        {
            channel_hub_connection_id: 'connection-id',
        },
    ],
    tag_update_flow_id: FLOW_ID,
    tag_deletion_flow_id: DELETE_FLOW_ID,
};

const createQueuer = ({ workspaceResult = workspace } = {}) => {
    const workspaceRepository = {
        find: jest.fn().mockResolvedValue(workspaceResult),
    };
    const executionRepository = {
        save: jest.fn().mockImplementation((execution) => Promise.resolve(execution)),
    };
    const eventPublisher = {
        publish: jest.fn().mockResolvedValue(undefined),
    };

    const executionIds = [EXECUTION_ID, SECOND_EXECUTION_ID];
    const queuer = new WorkspaceTagUpdateFlowQueuer({
        workspaceRepository,
        executionRepository,
        eventPublisher,
        currentUser: { id: { value: USER_ID } },
        metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
        kaceApiBaseUrl: 'https://correos-api.kace-cloudtest.com/',
        idFactory: () => executionIds.shift() ?? EXECUTION_ID,
        now: () => new Date('2026-05-22T13:00:00.000Z'),
    });

    return { queuer, workspaceRepository, executionRepository, eventPublisher };
};

describe('WorkspaceTagUpdateFlowQueuer', () => {
    it('queues the workspace update tag flow with Channel Hub tag context', async () => {
        const { queuer, workspaceRepository, executionRepository, eventPublisher } = createQueuer();

        const queued = await queuer.execute(WORKSPACE_ID);

        expect(queued).toBe(true);
        expect(workspaceRepository.find).toHaveBeenCalledWith({ value: WORKSPACE_ID });
        expect(executionRepository.save).toHaveBeenCalledTimes(1);

        const execution = executionRepository.save.mock.calls[0][0];
        expect(execution.id.value).toBe(EXECUTION_ID);
        expect(execution.flow_id.value).toBe(FLOW_ID);
        expect(execution.status.value).toBe('pending');
        expect(execution.created_by.value).toBe(USER_ID);
        expect(execution.initial_context.value).toEqual({
            source: 'workspaces.update',
            tenant_id: TENANT_ID,
            kace_api_base_url: 'https://correos-api.kace-cloudtest.com',
            workspace,
            channel_hub_tag: {
                connectionId: 'connection-id',
                ruleId: 'channel-rule-id',
                ruleName: 'support-custom',
                subjectContains: ['billing'],
                subjectEquals: ['ignored by normalizer later'],
                bodyEquals: ['urgent'],
                actionRules: {
                    classifyAs: 'support',
                },
            },
        });

        expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
        const event = eventPublisher.publish.mock.calls[0][0];
        expect(event).toBeInstanceOf(WSRestFlowExecutionRequested);
        expect(event.toJson()).toMatchObject({
            eventName: WSRestFlowExecutionRequested.EVENT_NAME,
            aggregateId: EXECUTION_ID,
            payload: {
                flowId: FLOW_ID,
                externalCode: null,
                initialContext: execution.initial_context.value,
            },
            metadata: {
                tenant_id: TENANT_ID,
                user_id: USER_ID,
            },
        });
    });

    it('skips queueing when the workspace has no update flow configured', async () => {
        const { queuer, executionRepository, eventPublisher } = createQueuer({
            workspaceResult: { ...workspace, tag_update_flow_id: null },
        });

        await expect(queuer.execute(WORKSPACE_ID)).resolves.toBe(false);
        expect(executionRepository.save).not.toHaveBeenCalled();
        expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('skips queueing when the workspace has no Channel Hub rule id', async () => {
        const { ruleId: _ruleId, ...rulesWithoutRuleId } = workspace.rules;
        const { queuer, executionRepository, eventPublisher } = createQueuer({
            workspaceResult: { ...workspace, rules: rulesWithoutRuleId },
        });

        await expect(queuer.execute(WORKSPACE_ID)).resolves.toBe(false);
        expect(executionRepository.save).not.toHaveBeenCalled();
        expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('queues the workspace delete tag flow with Channel Hub tag context', async () => {
        const { queuer, executionRepository, eventPublisher } = createQueuer();

        const queued = await queuer.execute(WORKSPACE_ID, 'delete');

        expect(queued).toBe(true);
        expect(executionRepository.save).toHaveBeenCalledTimes(1);

        const execution = executionRepository.save.mock.calls[0][0];
        expect(execution.flow_id.value).toBe(DELETE_FLOW_ID);
        expect(execution.initial_context.value).toMatchObject({
            source: 'workspaces.delete',
            workspace,
            channel_hub_tag: {
                connectionId: 'connection-id',
                ruleId: 'channel-rule-id',
            },
        });

        expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
        expect(eventPublisher.publish.mock.calls[0][0].toJson()).toMatchObject({
            payload: {
                flowId: DELETE_FLOW_ID,
                initialContext: execution.initial_context.value,
            },
        });
    });

    it('queues one update execution per registered Channel Hub account', async () => {
        const multiAccountWorkspace = {
            ...workspace,
            rules: { ...workspace.rules, ruleId: undefined },
            channel_hub_accounts: [
                { channel_hub_connection_id: 'connection-1', channel_hub_rule_id: 'rule-1' },
                { channel_hub_connection_id: 'connection-2', channel_hub_rule_id: 'rule-2' },
            ],
        };
        const { queuer, executionRepository, eventPublisher } = createQueuer({
            workspaceResult: multiAccountWorkspace,
        });

        await expect(queuer.execute(WORKSPACE_ID)).resolves.toBe(true);

        expect(executionRepository.save).toHaveBeenCalledTimes(2);
        expect(eventPublisher.publish).toHaveBeenCalledTimes(2);

        const [firstExecution, secondExecution] = executionRepository.save.mock.calls.map((call) => call[0]);
        expect(firstExecution.id.value).toBe(EXECUTION_ID);
        expect(secondExecution.id.value).toBe(SECOND_EXECUTION_ID);
        expect(firstExecution.initial_context.value.channel_hub_tag).toMatchObject({
            connectionId: 'connection-1',
            ruleId: 'rule-1',
        });
        expect(secondExecution.initial_context.value.channel_hub_tag).toMatchObject({
            connectionId: 'connection-2',
            ruleId: 'rule-2',
        });
    });

    it('queues only registered accounts, skipping those pending registration', async () => {
        const { queuer, executionRepository } = createQueuer({
            workspaceResult: {
                ...workspace,
                rules: { ...workspace.rules, ruleId: undefined },
                channel_hub_accounts: [
                    { channel_hub_connection_id: 'connection-1', channel_hub_rule_id: 'rule-1' },
                    { channel_hub_connection_id: 'connection-pending', channel_hub_rule_id: null },
                ],
            },
        });

        await expect(queuer.execute(WORKSPACE_ID)).resolves.toBe(true);

        expect(executionRepository.save).toHaveBeenCalledTimes(1);
        expect(executionRepository.save.mock.calls[0][0].initial_context.value.channel_hub_tag).toMatchObject({
            connectionId: 'connection-1',
            ruleId: 'rule-1',
        });
    });

    it('queues one delete execution per registered Channel Hub account', async () => {
        const { queuer, executionRepository } = createQueuer({
            workspaceResult: {
                ...workspace,
                rules: { ...workspace.rules, ruleId: undefined },
                channel_hub_accounts: [
                    { channel_hub_connection_id: 'connection-1', channel_hub_rule_id: 'rule-1' },
                    { channel_hub_connection_id: 'connection-2', channel_hub_rule_id: 'rule-2' },
                ],
            },
        });

        await expect(queuer.execute(WORKSPACE_ID, 'delete')).resolves.toBe(true);

        expect(executionRepository.save).toHaveBeenCalledTimes(2);
        const flowIds = executionRepository.save.mock.calls.map((call) => call[0].flow_id.value);
        expect(flowIds).toEqual([DELETE_FLOW_ID, DELETE_FLOW_ID]);
    });

    it('falls back to the legacy scalar rules.ruleId for a single account without relation rule id', async () => {
        const { queuer, executionRepository } = createQueuer();

        await expect(queuer.execute(WORKSPACE_ID)).resolves.toBe(true);

        expect(executionRepository.save).toHaveBeenCalledTimes(1);
        expect(executionRepository.save.mock.calls[0][0].initial_context.value.channel_hub_tag).toMatchObject({
            connectionId: 'connection-id',
            ruleId: 'channel-rule-id',
        });
    });

    it('skips delete queueing when the workspace has no deletion flow configured', async () => {
        const { queuer, executionRepository, eventPublisher } = createQueuer({
            workspaceResult: { ...workspace, tag_deletion_flow_id: null },
        });

        await expect(queuer.execute(WORKSPACE_ID, 'delete')).resolves.toBe(false);
        expect(executionRepository.save).not.toHaveBeenCalled();
        expect(eventPublisher.publish).not.toHaveBeenCalled();
    });
});

describe('WorkspaceTagUpdateFlowQueuer with explicit targets', () => {
    it('queues delete flows for the given targets even when the workspace no longer holds those accounts', async () => {
        const { queuer, executionRepository, eventPublisher } = createQueuer({
            workspaceResult: {
                ...workspace,
                rules: { ...workspace.rules, ruleId: undefined },
                channel_hub_accounts: [
                    {
                        id: 'kept-account',
                        channel_hub_connection_id: 'connection-kept',
                        channel_hub_rule_id: 'rule-kept',
                    },
                ],
            },
        });

        const removedTargets = [
            {
                channel_hub_account_id: 'removed-account',
                connectionId: 'connection-removed',
                ruleId: 'rule-removed',
            },
        ];

        await expect(queuer.execute(WORKSPACE_ID, 'delete', { targets: removedTargets })).resolves.toBe(true);

        expect(executionRepository.save).toHaveBeenCalledTimes(1);
        const execution = executionRepository.save.mock.calls[0][0];
        expect(execution.flow_id.value).toBe(DELETE_FLOW_ID);
        expect(execution.initial_context.value.channel_hub_tag).toMatchObject({
            connectionId: 'connection-removed',
            ruleId: 'rule-removed',
        });
        expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    });

    it('skips queueing when the explicit target list is empty', async () => {
        const { queuer, executionRepository } = createQueuer();

        await expect(queuer.execute(WORKSPACE_ID, 'delete', { targets: [] })).resolves.toBe(false);
        expect(executionRepository.save).not.toHaveBeenCalled();
    });
});

describe('channelHubRuleTargets', () => {
    it('identifies each target with its channel_hub_account_id', () => {
        expect(
            channelHubRuleTargets({
                rules: {},
                channel_hub_accounts: [
                    { id: 'account-1', channel_hub_connection_id: 'connection-1', channel_hub_rule_id: 'rule-1' },
                    { id: 'account-2', channel_hub_connection_id: 'connection-2', channel_hub_rule_id: 'rule-2' },
                ],
            })
        ).toEqual([
            { channel_hub_account_id: 'account-1', connectionId: 'connection-1', ruleId: 'rule-1' },
            { channel_hub_account_id: 'account-2', connectionId: 'connection-2', ruleId: 'rule-2' },
        ]);
    });
});

describe('removedChannelHubRuleTargets', () => {
    const previousWorkspace = {
        rules: {},
        channel_hub_accounts: [
            { id: 'kept-account', channel_hub_connection_id: 'connection-kept', channel_hub_rule_id: 'rule-kept' },
            {
                id: 'removed-account',
                channel_hub_connection_id: 'connection-removed',
                channel_hub_rule_id: 'rule-removed',
            },
            { id: 'pending-account', channel_hub_connection_id: 'connection-pending', channel_hub_rule_id: null },
        ],
    };

    it('returns targets only for removed accounts that had a registered rule', () => {
        const nextAccounts = [{ id: 'kept-account' }];

        expect(removedChannelHubRuleTargets(previousWorkspace, nextAccounts)).toEqual([
            {
                channel_hub_account_id: 'removed-account',
                connectionId: 'connection-removed',
                ruleId: 'rule-removed',
            },
        ]);
    });

    it('returns every registered account as removed when the next set clears all accounts', () => {
        expect(removedChannelHubRuleTargets(previousWorkspace, null)).toEqual([
            { channel_hub_account_id: 'kept-account', connectionId: 'connection-kept', ruleId: 'rule-kept' },
            {
                channel_hub_account_id: 'removed-account',
                connectionId: 'connection-removed',
                ruleId: 'rule-removed',
            },
        ]);
    });

    it('returns no targets when the account set does not shrink', () => {
        const nextAccounts = [{ id: 'kept-account' }, { id: 'removed-account' }, { id: 'new-account' }];

        expect(removedChannelHubRuleTargets(previousWorkspace, nextAccounts)).toEqual([]);
    });

    it('falls back to the legacy scalar rules.ruleId for a removed single legacy account', () => {
        const legacyWorkspace = {
            rules: { ruleId: 'legacy-rule-id' },
            channel_hub_accounts: [
                { id: 'legacy-account', channel_hub_connection_id: 'connection-legacy', channel_hub_rule_id: null },
            ],
        };

        expect(removedChannelHubRuleTargets(legacyWorkspace, [{ id: 'another-account' }])).toEqual([
            { channel_hub_account_id: 'legacy-account', connectionId: 'connection-legacy', ruleId: 'legacy-rule-id' },
        ]);
    });
});

describe('rulesWithoutRemovedLegacyRuleId', () => {
    const removedTargets = [
        { channel_hub_account_id: 'removed-account', connectionId: 'connection-removed', ruleId: 'legacy-rule-id' },
    ];

    it('strips the legacy scalar ruleId when its owning account was removed', () => {
        expect(
            rulesWithoutRemovedLegacyRuleId(
                { ruleId: 'legacy-rule-id', ruleName: 'support', subjectContains: ['billing'] },
                removedTargets
            )
        ).toEqual({ ruleName: 'support', subjectContains: ['billing'] });
    });

    it('keeps the scalar ruleId when no removed target owns it', () => {
        const rules = { ruleId: 'other-rule-id', ruleName: 'support' };

        expect(rulesWithoutRemovedLegacyRuleId(rules, removedTargets)).toEqual(rules);
    });

    it('returns the rules untouched when there is no scalar ruleId', () => {
        const rules = { ruleName: 'support' };

        expect(rulesWithoutRemovedLegacyRuleId(rules, removedTargets)).toEqual(rules);
        expect(rulesWithoutRemovedLegacyRuleId(null, removedTargets)).toBeNull();
        expect(rulesWithoutRemovedLegacyRuleId(undefined, removedTargets)).toBeUndefined();
    });

    it('returns the rules untouched when nothing was removed', () => {
        const rules = { ruleId: 'legacy-rule-id', ruleName: 'support' };

        expect(rulesWithoutRemovedLegacyRuleId(rules, [])).toEqual(rules);
    });
});

describe('buildChannelHubTagContext', () => {
    it('falls back to workspace tag when ruleName and actionRules are absent', () => {
        expect(
            buildChannelHubTagContext({
                ...workspace,
                rules: { ruleId: 'rule-id' },
                channel_hub_connection_id: 'fallback-connection-id',
                channel_hub_accounts: [],
            })
        ).toEqual({
            connectionId: 'fallback-connection-id',
            ruleId: 'rule-id',
            ruleName: 'support',
            actionRules: {
                classifyAs: 'support',
            },
        });
    });
});
