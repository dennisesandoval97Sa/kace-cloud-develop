import { randomUUID } from 'node:crypto';
import {
    publicErrorCodeForWorkspaceValidation,
    WorkspaceCreateSchema,
    WorkspaceUpdateSchema,
} from '../src/WorkspaceSchema.mjs';
import { WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED } from '@kace/error-codes';

const uuid = 'cc7abc0c-a7a3-4226-8dfd-01a1d5e9d457';
const userId = '3824c61a-6368-4c5c-957f-769525109e85';
const tagCreationFlowId = '6e6a7b7f-2b9f-45bb-b639-c313ea5fd28a';
const tagUpdateFlowId = 'd29967a3-8988-4b78-9542-c3c1fe4a992b';
const tagDeletionFlowId = '17da1fa7-e0b4-45a1-9b82-393ea2362d39';
const channelHubAccountId = '6ecb6537-80b5-4bbd-8caa-17341659d6d2';
const secondChannelHubAccountId = '5377aa7c-0ed4-4ec1-9fd9-565dfb144f6c';

const transformedRules = {
    ruleId: 'channel-hub-rule-id',
    ruleName: 'juanfezaga',
    subjectContains: ['test'],
    subjectEquals: [],
    ccContains: [],
    ccEquals: [],
    fromContains: [],
    fromEquals: [],
    actionRules: {
        classifyAs: 'juanfezaga',
    },
};

describe('WorkspaceSchema', () => {
    it('accepts transformed workspace rules object on create', () => {
        const result = WorkspaceCreateSchema.validate(
            {
                id: uuid,
                description: 'workspace-test',
                tag: 'juanfezaga',
                is_active: true,
                rules: transformedRules,
                channel_hub_accounts: [{ id: channelHubAccountId }],
                groups: [{ id: userId }],
                tag_creation_flow_id: tagCreationFlowId,
                tag_update_flow_id: tagUpdateFlowId,
                tag_deletion_flow_id: tagDeletionFlowId,
                created_by: userId,
                created_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.rules).toEqual(transformedRules);
        expect(result.value.tag_creation_flow_id).toBe(tagCreationFlowId);
        expect(result.value.tag_update_flow_id).toBe(tagUpdateFlowId);
        expect(result.value.tag_deletion_flow_id).toBe(tagDeletionFlowId);
    });

    it('accepts transformed workspace rules object on update', () => {
        const result = WorkspaceUpdateSchema.validate(
            {
                description: 'workspace-test',
                tag: 'juanfezaga',
                is_active: true,
                rules: transformedRules,
                channel_hub_accounts: [{ id: channelHubAccountId }],
                groups: [{ id: userId }],
                tag_creation_flow_id: tagCreationFlowId,
                tag_update_flow_id: tagUpdateFlowId,
                tag_deletion_flow_id: tagDeletionFlowId,
                updated_by: userId,
                updated_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.rules).toEqual(transformedRules);
        expect(result.value.tag_creation_flow_id).toBe(tagCreationFlowId);
        expect(result.value.tag_update_flow_id).toBe(tagUpdateFlowId);
        expect(result.value.tag_deletion_flow_id).toBe(tagDeletionFlowId);
    });

    it('accepts creating a workspace with no group assignments', () => {
        const result = WorkspaceCreateSchema.validate(
            {
                id: uuid,
                description: 'workspace-without-groups',
                is_active: true,
                channel_hub_accounts: [{ id: channelHubAccountId }],
                groups: [],
                created_by: userId,
                created_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.groups).toEqual([]);
    });

    it('accepts clearing all group assignments on update', () => {
        const result = WorkspaceUpdateSchema.validate(
            {
                groups: [],
                updated_by: userId,
                updated_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.groups).toEqual([]);
    });

    it('preserves group assignments by allowing update payloads to omit groups', () => {
        const result = WorkspaceUpdateSchema.validate(
            {
                description: 'partial-edit',
                updated_by: userId,
                updated_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.groups).toBeUndefined();
    });

    it('rejects unrelated workspace rules objects', () => {
        const result = WorkspaceCreateSchema.validate(
            {
                id: uuid,
                description: 'workspace-test',
                tag: 'juanfezaga',
                is_active: true,
                rules: {
                    unexpectedRule: true,
                },
                created_by: userId,
                created_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeDefined();
    });

    it('requires at least one Channel Hub account on create', () => {
        for (const channel_hub_accounts of [undefined, null, []]) {
            const payload = {
                id: uuid,
                description: 'workspace-test',
                tag: 'juanfezaga',
                is_active: true,
                rules: transformedRules,
                groups: [{ id: userId }],
                created_by: userId,
                created_at: new Date().toISOString(),
            };
            if (channel_hub_accounts !== undefined) {
                payload.channel_hub_accounts = channel_hub_accounts;
            }

            const result = WorkspaceCreateSchema.validate(payload, { abortEarly: false });

            expect(result.error).toBeDefined();
            expect(publicErrorCodeForWorkspaceValidation(result.error)).toBe(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED);
        }
    });

    it('allows update payloads to omit Channel Hub accounts for partial edits', () => {
        const result = WorkspaceUpdateSchema.validate(
            {
                description: 'workspace-test',
                tag: 'juanfezaga',
                is_active: true,
                rules: transformedRules,
                groups: [{ id: userId }],
                updated_by: userId,
                updated_at: new Date().toISOString(),
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.channel_hub_accounts).toBeUndefined();
    });

    it('rejects update payloads that explicitly remove every Channel Hub account', () => {
        for (const channel_hub_accounts of [null, []]) {
            const result = WorkspaceUpdateSchema.validate(
                {
                    description: 'workspace-test',
                    tag: 'juanfezaga',
                    is_active: true,
                    rules: transformedRules,
                    channel_hub_accounts,
                    groups: [{ id: userId }],
                    updated_by: userId,
                    updated_at: new Date().toISOString(),
                },
                { abortEarly: false }
            );

            expect(result.error).toBeDefined();
            expect(publicErrorCodeForWorkspaceValidation(result.error)).toBe(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED);
        }
    });

    it.each([
        ['create', WorkspaceCreateSchema, { id: uuid, created_by: userId, created_at: new Date().toISOString() }],
        ['update', WorkspaceUpdateSchema, { updated_by: userId, updated_at: new Date().toISOString() }],
    ])('accepts %s payloads with one Channel Hub account', (_name, schema, requiredFields) => {
        const channel_hub_accounts = [{ id: channelHubAccountId }];
        const result = schema.validate(
            {
                ...requiredFields,
                description: 'workspace-test',
                tag: 'juanfezaga',
                is_active: true,
                rules: transformedRules,
                channel_hub_accounts,
                groups: [{ id: userId }],
            },
            { abortEarly: false }
        );

        expect(result.error).toBeUndefined();
        expect(result.value.channel_hub_accounts).toEqual(channel_hub_accounts);
    });

    it.each([
        ['create', WorkspaceCreateSchema, { id: uuid, created_by: userId, created_at: new Date().toISOString() }],
        ['update', WorkspaceUpdateSchema, { updated_by: userId, updated_at: new Date().toISOString() }],
    ])(
        'accepts %s payloads with several Channel Hub accounts (ADR-017: no upper bound)',
        (_name, schema, requiredFields) => {
            const manyAccounts = [{ id: channelHubAccountId }, { id: secondChannelHubAccountId }, { id: randomUUID() }];
            const result = schema.validate(
                {
                    ...requiredFields,
                    description: 'workspace-test',
                    tag: 'juanfezaga',
                    is_active: true,
                    rules: transformedRules,
                    channel_hub_accounts: manyAccounts,
                    groups: [{ id: userId }],
                },
                { abortEarly: false }
            );

            expect(result.error).toBeUndefined();
            expect(result.value.channel_hub_accounts).toEqual(manyAccounts);
        }
    );
});
