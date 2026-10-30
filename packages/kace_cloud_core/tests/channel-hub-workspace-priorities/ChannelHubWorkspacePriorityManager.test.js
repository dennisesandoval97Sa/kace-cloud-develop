import { jest } from '@jest/globals';
import { ChannelHubWorkspacePriorityManager } from '../../src/channel-hub-workspace-priorities/application/ChannelHubWorkspacePriorityManager.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import {
    CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID,
    CHANNEL_HUB_MAIL_RULE_PRIORITY_UPDATE_FLOW_INVALID,
} from '@kace/error-codes';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

const account = {
    id: { value: ACCOUNT_ID },
    channel_hub_connection_id: { value: 'connection-1234567' },
    mail_rule_list_rest_flow_id: { value: '22222222-2222-4222-8222-222222222222' },
    mail_rule_priority_update_rest_flow_id: { value: '33333333-3333-4333-8333-333333333333' },
};

const localMappings = [
    { workspaceId: 'workspace-sales', description: 'Sales', tag: 'sales', ruleId: 'rule-sales' },
    { workspaceId: 'workspace-support', description: 'Customer Support', tag: 'support', ruleId: 'rule-support' },
];

const remoteRules = [
    {
        id: 'rule-support',
        connectionId: 'connection-1234567',
        actionRules: { classifyAs: 'support' },
        priority: 1,
    },
    {
        id: 'rule-sales',
        connectionId: 'connection-1234567',
        actionRules: { classifyAs: 'sales' },
        priority: 2,
    },
];

const createSubject = ({ resolvedAccount = account, mappings = localMappings, rules = remoteRules } = {}) => {
    const accountRepository = { find: jest.fn().mockResolvedValue(resolvedAccount) };
    const workspaceRepository = {
        findChannelHubPriorityMappingsByAccountId: jest.fn().mockResolvedValue(mappings),
    };
    const mailRules = {
        listRules: jest.fn().mockResolvedValue(rules),
        updatePriority: jest.fn(),
    };
    const restFlowValidator = { execute: jest.fn().mockResolvedValue(undefined) };

    return {
        subject: new ChannelHubWorkspacePriorityManager({
            accountRepository,
            workspaceRepository,
            mailRules,
            restFlowValidator,
        }),
        accountRepository,
        workspaceRepository,
        mailRules,
        restFlowValidator,
    };
};

describe('ChannelHubWorkspacePriorityManager', () => {
    it('rejects an unknown Channel Hub account before querying workspace relations', async () => {
        const { subject, workspaceRepository, mailRules } = createSubject({ resolvedAccount: null });

        await expect(subject.get(ACCOUNT_ID)).rejects.toMatchObject({
            message: 'Channel Hub account not found',
            statusCode: 404,
        });
        expect(workspaceRepository.findChannelHubPriorityMappingsByAccountId).not.toHaveBeenCalled();
        expect(mailRules.listRules).not.toHaveBeenCalled();
    });

    it('lists Channel Hub priority using workspace descriptions and the stable rule relationship', async () => {
        const { subject, mailRules, restFlowValidator } = createSubject();

        const result = await subject.get(ACCOUNT_ID);

        expect(mailRules.listRules).toHaveBeenCalledWith(account);
        expect(restFlowValidator.execute).toHaveBeenNthCalledWith(
            1,
            account.mail_rule_list_rest_flow_id.value,
            'mail_rule_list_rest_flow_id'
        );
        expect(restFlowValidator.execute).toHaveBeenNthCalledWith(
            2,
            account.mail_rule_priority_update_rest_flow_id.value,
            'mail_rule_priority_update_rest_flow_id'
        );
        expect(result).toEqual({
            items: [
                { workspaceId: 'workspace-support', description: 'Customer Support', tag: 'support', priority: 1 },
                { workspaceId: 'workspace-sales', description: 'Sales', tag: 'sales', priority: 2 },
            ],
            revision: expect.any(String),
            canReorder: true,
            conflicts: [],
        });
    });

    it('reports an invalid list RestFlow using its public code without executing it', async () => {
        const { subject, restFlowValidator, mailRules } = createSubject();
        restFlowValidator.execute.mockImplementation(async (_restFlowId, field) => {
            if (field === 'mail_rule_list_rest_flow_id') {
                throw new ValidationFailError(
                    'The selected Rest Flow is not a valid Channel Hub mail-rule list flow',
                    field,
                    [],
                    CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID
                );
            }
        });

        const result = await subject.get(ACCOUNT_ID);

        expect(mailRules.listRules).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            canReorder: false,
            conflicts: [
                {
                    code: CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID,
                    message: 'The selected Rest Flow is not a valid Channel Hub mail-rule list flow',
                },
            ],
        });
    });

    it('blocks updates when the priority update RestFlow is no longer valid', async () => {
        const { subject, restFlowValidator, mailRules } = createSubject();
        restFlowValidator.execute.mockImplementation(async (_restFlowId, field) => {
            if (field === 'mail_rule_priority_update_rest_flow_id') {
                throw new ValidationFailError(
                    'The selected Rest Flow is not a valid Channel Hub mail-rule priority update flow',
                    field,
                    [],
                    CHANNEL_HUB_MAIL_RULE_PRIORITY_UPDATE_FLOW_INVALID
                );
            }
        });

        await expect(
            subject.validateReorderRequest(ACCOUNT_ID, {
                revision: 'any-revision',
                orderedWorkspaceIds: ['workspace-support', 'workspace-sales'],
            })
        ).rejects.toMatchObject({
            message: 'Workspace priorities cannot be changed while configuration conflicts exist',
            statusCode: 409,
        });
        expect(mailRules.listRules).toHaveBeenCalledWith(account);
        expect(mailRules.updatePriority).not.toHaveBeenCalled();

        const current = await subject.get(ACCOUNT_ID);
        expect(current.conflicts).toContainEqual({
            code: CHANNEL_HUB_MAIL_RULE_PRIORITY_UPDATE_FLOW_INVALID,
            message: 'The selected Rest Flow is not a valid Channel Hub mail-rule priority update flow',
        });
    });

    it('reports a tag mismatch instead of guessing the workspace from the remote rule name', async () => {
        const rules = remoteRules.map((rule) =>
            rule.id === 'rule-support' ? { ...rule, actionRules: { classifyAs: 'unexpected-tag' } } : rule
        );
        const { subject } = createSubject({ rules });

        const result = await subject.get(ACCOUNT_ID);

        expect(result.canReorder).toBe(false);
        expect(result.items[0]).toEqual({
            workspaceId: 'workspace-support',
            description: 'Customer Support',
            tag: 'support',
            priority: 1,
        });
        expect(result.conflicts).toEqual([
            {
                code: 'TAG_MISMATCH',
                message:
                    'Workspace "Customer Support" uses tag "support", but Channel Hub rule "rule-support" classifies as "unexpected-tag".',
                workspaceId: 'workspace-support',
            },
        ]);
    });

    it('returns actionable configuration conflicts without calling Channel Hub', async () => {
        const unconfiguredAccount = {
            ...account,
            channel_hub_connection_id: { value: null },
            mail_rule_list_rest_flow_id: { value: null },
            mail_rule_priority_update_rest_flow_id: { value: null },
        };
        const { subject, mailRules } = createSubject({ resolvedAccount: unconfiguredAccount });

        const result = await subject.get(ACCOUNT_ID);

        expect(mailRules.listRules).not.toHaveBeenCalled();
        expect(result).toEqual({
            items: [
                { workspaceId: 'workspace-sales', description: 'Sales', tag: 'sales', priority: null },
                {
                    workspaceId: 'workspace-support',
                    description: 'Customer Support',
                    tag: 'support',
                    priority: null,
                },
            ],
            revision: expect.any(String),
            canReorder: false,
            conflicts: [
                {
                    code: 'ACCOUNT_NOT_REGISTERED',
                    message: 'The Channel Hub account is not registered.',
                },
                {
                    code: 'LIST_FLOW_NOT_CONFIGURED',
                    message: 'A mail-rule listing RestFlow must be selected.',
                },
                {
                    code: 'UPDATE_FLOW_NOT_CONFIGURED',
                    message: 'A mail-rule priority update RestFlow must be selected.',
                },
            ],
        });
    });

    it('reports unregistered workspaces and unknown remote rules without inventing a mapping', async () => {
        const mappings = [
            localMappings[1],
            {
                workspaceId: 'workspace-unregistered',
                description: 'Unregistered workspace',
                tag: 'unregistered',
                ruleId: null,
            },
        ];
        const rules = [remoteRules[0], { ...remoteRules[1], id: 'rule-unknown' }];
        const { subject } = createSubject({ mappings, rules });

        const result = await subject.get(ACCOUNT_ID);

        expect(result.items).toEqual([
            {
                workspaceId: 'workspace-support',
                description: 'Customer Support',
                tag: 'support',
                priority: 1,
            },
            {
                workspaceId: 'workspace-unregistered',
                description: 'Unregistered workspace',
                tag: 'unregistered',
                priority: null,
            },
        ]);
        expect(result.canReorder).toBe(false);
        expect(result.conflicts).toEqual([
            {
                code: 'MISSING_RULE_ID',
                message: 'Workspace "Unregistered workspace" is not registered as a Channel Hub mail rule.',
                workspaceId: 'workspace-unregistered',
            },
            {
                code: 'UNMAPPED_REMOTE_RULE',
                message: 'Channel Hub rule "rule-unknown" is not linked to a KACE workspace.',
            },
        ]);
    });

    it('reports duplicate local rule relationships as an ambiguous configuration', async () => {
        const mappings = [
            localMappings[1],
            {
                workspaceId: 'workspace-support-copy',
                description: 'Customer Support Copy',
                tag: 'support',
                ruleId: 'rule-support',
            },
        ];
        const { subject } = createSubject({ mappings, rules: [remoteRules[0]] });

        const result = await subject.get(ACCOUNT_ID);

        expect(result.canReorder).toBe(false);
        expect(result.conflicts).toContainEqual({
            code: 'DUPLICATE_RULE_ID',
            message: 'Channel Hub rule "rule-support" is linked to multiple KACE workspaces.',
        });
    });

    it('reports a missing workspace description without substituting its routing tag as the name', async () => {
        const mappingWithoutDescription = { ...localMappings[1], description: null };
        const { subject } = createSubject({ mappings: [mappingWithoutDescription], rules: [remoteRules[0]] });

        const result = await subject.get(ACCOUNT_ID);

        expect(result.items).toEqual([
            {
                workspaceId: 'workspace-support',
                description: '',
                tag: 'support',
                priority: 1,
            },
        ]);
        expect(result.canReorder).toBe(false);
        expect(result.conflicts).toContainEqual({
            code: 'MISSING_WORKSPACE_DESCRIPTION',
            message: 'Workspace "workspace-support" needs a description to be shown in the priority list.',
            workspaceId: 'workspace-support',
        });
    });

    it('blocks reordering when Channel Hub priorities are not a contiguous sequence', async () => {
        const rules = [remoteRules[0], { ...remoteRules[1], priority: 3 }];
        const { subject } = createSubject({ rules });

        const result = await subject.get(ACCOUNT_ID);

        expect(result.canReorder).toBe(false);
        expect(result.conflicts).toContainEqual({
            code: 'INVALID_PRIORITY_SEQUENCE',
            message: 'Channel Hub returned a non-contiguous or duplicate priority sequence.',
        });
    });

    it('reports duplicate rule ids returned by Channel Hub', async () => {
        const rules = [remoteRules[0], { ...remoteRules[0], priority: 2 }];
        const { subject } = createSubject({ mappings: [localMappings[1]], rules });

        const result = await subject.get(ACCOUNT_ID);

        expect(result.canReorder).toBe(false);
        expect(result.conflicts).toContainEqual({
            code: 'DUPLICATE_REMOTE_RULE',
            message: 'Channel Hub returned rule "rule-support" more than once.',
        });
    });

    it('reports when the account has no linked workspaces to prioritize', async () => {
        const { subject } = createSubject({ mappings: [], rules: [] });

        const result = await subject.get(ACCOUNT_ID);

        expect(result).toMatchObject({
            items: [],
            canReorder: false,
            conflicts: [
                {
                    code: 'NO_LINKED_WORKSPACES',
                    message: 'The Channel Hub account has no linked workspaces to prioritize.',
                },
            ],
        });
    });

    it('turns the Channel Hub no-rules response into a configuration conflict', async () => {
        const { subject, mailRules } = createSubject();
        mailRules.listRules.mockRejectedValue(
            Object.assign(new Error('Channel Hub did not return a valid mail-rule list'), { upstreamStatus: 404 })
        );

        const result = await subject.get(ACCOUNT_ID);

        expect(result.canReorder).toBe(false);
        expect(result.items.every((item) => item.priority === null)).toBe(true);
        expect(result.conflicts).toEqual([
            {
                code: 'REMOTE_RULES_NOT_FOUND',
                message: 'Channel Hub has no mail rules for this account.',
            },
        ]);
    });

    it('reconciles one move at a time and reloads the live order after the write', async () => {
        const { subject, mailRules } = createSubject();
        const movedRules = [
            { ...remoteRules[1], priority: 1 },
            { ...remoteRules[0], priority: 2 },
        ];
        mailRules.listRules.mockReset().mockResolvedValueOnce(remoteRules).mockResolvedValueOnce(movedRules);

        const result = await subject.reconcileNext(ACCOUNT_ID, ['workspace-sales', 'workspace-support']);

        expect(mailRules.updatePriority).toHaveBeenCalledTimes(1);
        expect(mailRules.updatePriority).toHaveBeenCalledWith(account, 'rule-sales', 1);
        expect(mailRules.listRules).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({
            completed: true,
            moved: { workspaceId: 'workspace-sales', priority: 1 },
            result: { canReorder: true },
        });

        await subject.reconcileNext(ACCOUNT_ID, ['workspace-sales', 'workspace-support'], {
            snapshot: result.snapshot,
        });
        expect(mailRules.listRules).toHaveBeenCalledTimes(2);
    });

    it('validates the exact workspace set before a reconciliation write', async () => {
        const { subject, mailRules } = createSubject();

        await expect(subject.reconcileNext(ACCOUNT_ID, ['workspace-support'])).rejects.toMatchObject({
            statusCode: 409,
        });
        expect(mailRules.updatePriority).not.toHaveBeenCalled();
    });

    it('treats a write that is not yet visible in the refreshed order as retryable', async () => {
        const { subject, mailRules } = createSubject();
        mailRules.listRules.mockReset().mockResolvedValue(remoteRules);

        await expect(subject.reconcileNext(ACCOUNT_ID, ['workspace-sales', 'workspace-support'])).rejects.toMatchObject(
            { statusCode: 502 }
        );
        expect(mailRules.updatePriority).toHaveBeenCalledWith(account, 'rule-sales', 1);
    });
});
