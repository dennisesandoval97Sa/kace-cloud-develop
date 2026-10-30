import { v4 as uuidV4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CustomError } from '../../src/shared/index.js';
import { Workspaces } from '../../src/workspaces/domain/Workspaces.js';
import { WorkspaceCollectionResponse } from '../../src/workspaces/application/WorkspaceCollectionResponse.js';
import { WorkspaceCreator } from '../../src/workspaces/application/create/WorkspaceCreator.js';
import { WorkspaceFinder } from '../../src/workspaces/application/find/WorkspaceFinder.js';
import { WorkspaceUpdater } from '../../src/workspaces/application/update/WorkspaceUpdater.js';
import { WorkspaceDeactivator } from '../../src/workspaces/application/update/WorkspaceDeactivator.js';
import { WorkspaceDeleter } from '../../src/workspaces/application/delete/WorkspaceDeleter.js';
import { WorkspaceSearcher } from '../../src/workspaces/application/search/WorkspaceSearcher.js';
import { WorkspacesCounter } from '../../src/workspaces/domain/WorkspacesCounter.js';
import { WorkspaceResponse } from '../../src/workspaces/application/WorkspaceResponse.js';
import {
    DEFAULT_INBOX_WORKSPACE_ID,
    KnexWorkspacesRepository,
} from '../../src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED } from '@kace/error-codes';
import { WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED_MESSAGE } from '../../src/workspaces/domain/WorkspaceChannelHubAccountRequirement.js';

describe('Workspaces Test', () => {
    const repository = new KnexWorkspacesRepository(knexConfig);

    async function createChannelHubAccount(overrides = {}) {
        const restFlowId = overrides.rest_flow_id ?? uuidV4();
        const accountId = overrides.id ?? uuidV4();
        await repository.connection('ws_rest_flows').insert({ id: restFlowId });
        await repository.connection('channel_hub_accounts').insert({
            id: accountId,
            email: overrides.email ?? `${accountId}@example.com`,
            name: overrides.name ?? `Account ${accountId}`,
            country_id: overrides.country_id ?? 'CO',
            operator_id: overrides.operator_id ?? 'imap',
            rest_flow_id: restFlowId,
            channel_hub_connection_id: overrides.channel_hub_connection_id ?? `conn_${accountId}`,
            is_active: overrides.is_active ?? true,
            created_by: overrides.created_by ?? uuidV4(),
            created_at: overrides.created_at ?? new Date().toISOString(),
            updated_by: overrides.updated_by ?? uuidV4(),
            updated_at: overrides.updated_at ?? new Date().toISOString(),
            deleted_at: overrides.deleted_at ?? null,
        });

        return accountId;
    }

    async function createGroup(overrides = {}) {
        const groupId = overrides.id ?? uuidV4();
        await repository.connection('grupos').insert({
            id: groupId,
            nombre: overrides.nombre ?? `Group ${groupId}`,
            status: overrides.status ?? 1,
            descripcion: overrides.descripcion ?? 'Workspace test group',
            deleted_at: overrides.deleted_at ?? null,
        });
        return groupId;
    }

    async function createWorkspaceDto(overrides = {}) {
        const channelHubAccounts = Object.prototype.hasOwnProperty.call(overrides, 'channel_hub_accounts')
            ? overrides.channel_hub_accounts
            : [{ id: await createChannelHubAccount() }];

        return {
            id: overrides.id ?? uuidV4(),
            description: overrides.description ?? `TEST-${uuidV4()}`,
            is_active: overrides.is_active ?? true,
            tag: overrides.tag ?? `tag-${uuidV4()}`,
            rules: overrides.rules ?? { notifications: true },
            mails_accounts: overrides.mails_accounts ?? [],
            channel_hub_accounts: channelHubAccounts,
            groups: overrides.groups ?? [],
            created_by: overrides.created_by ?? uuidV4(),
            created_at: overrides.created_at ?? new Date().toISOString(),
            ...overrides,
        };
    }

    it('creates a new Workspaces instance', async () => {
        const mailAccountId = uuidV4();
        await repository.connection('mail_accounts').insert({
            id: mailAccountId,
            description: 'Test Mail Account',
            type: 'smtp',
            // `mail_accounts.is_active` es la antigua columna `status`: integer.
            is_active: 1,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'inbox-tag',
            rules: { auto_assign: true, priority: 'high' },
            mails_accounts: [{ id: mailAccountId }],
            channel_hub_accounts: [{ id: await createChannelHubAccount({ email: 'create-workspace@example.com' }) }],
            groups: [],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };
        const workspaceCreator = new WorkspaceCreator(repository);

        await workspaceCreator.execute(dto);

        const result = await repository.connection('workspaces').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should throw an error when creating an existing Workspace', async () => {
        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'duplicate-tag',
            rules: { auto_assign: false },
            mails_accounts: [],
            channel_hub_accounts: [{ id: await createChannelHubAccount({ email: 'duplicate-workspace@example.com' }) }],
            groups: [],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };
        const workspaceCreator = new WorkspaceCreator(repository);

        await workspaceCreator.execute(dto);

        const groupCreator = new WorkspaceCreator(repository);

        await expect(groupCreator.execute(dto)).rejects.toThrow(
            new CustomError(`Workspace with id ${dto.id} already exists`)
        );
    });

    it('should not create a new Workspaces instance when null dto', async () => {
        const groupCreator = new WorkspaceCreator(repository);
        await expect(groupCreator.execute(null)).rejects.toThrow(Error);
    });

    it('rejects creating a Workspace without a Channel Hub account', async () => {
        const workspaceCreator = new WorkspaceCreator(repository);
        const dto = await createWorkspaceDto({ channel_hub_accounts: [] });

        await expect(workspaceCreator.execute(dto)).rejects.toThrow(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED_MESSAGE);
    });

    it('rejects creating a Workspace when only soft-deleted Channel Hub accounts are selected', async () => {
        const deletedChannelHubAccountId = await createChannelHubAccount({
            email: 'deleted-channel-hub-account@example.com',
            deleted_at: new Date().toISOString(),
        });
        const workspaceCreator = new WorkspaceCreator(repository);
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: deletedChannelHubAccountId }],
        });

        try {
            await workspaceCreator.execute(dto);
            throw new Error('Expected WorkspaceCreator to reject a soft-deleted Channel Hub account');
        } catch (error) {
            expect(error.message).toBe(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED_MESSAGE);
            expect(error.publicErrorCode).toBe(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED);
        }
    });

    it('finds an existing Workspace instance by id', async () => {
        const mailAccountId = uuidV4();
        await repository.connection('mail_accounts').insert({
            id: mailAccountId,
            description: 'Finder Mail Account',
            type: 'imap',
            // `mail_accounts.is_active` es la antigua columna `status`: integer.
            is_active: 1,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'finder-tag',
            rules: { notifications: true },
            mails_accounts: [{ id: mailAccountId }],
            channel_hub_accounts: [{ id: await createChannelHubAccount({ email: 'finder-workspace@example.com' }) }],
            groups: [],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };
        const workspaceCreator = new WorkspaceCreator(repository);

        await workspaceCreator.execute(dto);
        const groupFinder = new WorkspaceFinder(repository);

        const workspace = await groupFinder.execute(dto.id);

        expect(workspace).not.toBeNull();
        expect(workspace).toBeInstanceOf(WorkspaceResponse);
        const workspaceData = workspace.toJson().data;
        expect(Array.isArray(workspaceData.mails_accounts)).toBe(true);
        if (workspaceData.mails_accounts.length > 0) {
            expect(workspaceData.mails_accounts[0]).toHaveProperty('id');
            expect(workspaceData.mails_accounts[0]).toHaveProperty('description');
        }
    });

    it('finds selected Channel Hub accounts and groups for a workspace', async () => {
        const restFlowId = uuidV4();
        const channelHubAccountId = uuidV4();
        const groupId = uuidV4();

        await repository.connection('ws_rest_flows').insert({ id: restFlowId });
        await repository.connection('channel_hub_accounts').insert({
            id: channelHubAccountId,
            email: 'support@example.com',
            name: 'Support',
            country_id: 'CO',
            operator_id: 'imap',
            rest_flow_id: restFlowId,
            channel_hub_connection_id: null,
            is_active: true,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
            updated_by: uuidV4(),
            updated_at: new Date().toISOString(),
        });
        await repository.connection('grupos').insert({
            id: groupId,
            nombre: 'Administrators',
            status: 1,
            descripcion: 'Admin group',
        });

        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'channel-hub-tag',
            rules: { notifications: true },
            mails_accounts: [],
            channel_hub_accounts: [{ id: channelHubAccountId }],
            groups: [{ id: groupId }],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };
        const workspaceCreator = new WorkspaceCreator(repository);

        await workspaceCreator.execute(dto);
        const workspace = await new WorkspaceFinder(repository).execute(dto.id);

        const workspaceData = workspace.toJson().data;
        expect(workspaceData.channel_hub_accounts).toHaveLength(1);
        expect(workspaceData.channel_hub_accounts[0]).toMatchObject({
            id: channelHubAccountId,
            email: 'support@example.com',
            name: 'Support',
        });
        expect(workspaceData.groups).toHaveLength(1);
        expect(workspaceData.groups[0]).toMatchObject({
            id: groupId,
            nombre: 'Administrators',
        });
    });

    it('creates a workspace with an explicit empty group list', async () => {
        const dto = await createWorkspaceDto({ groups: [] });

        await new WorkspaceCreator(repository).execute(dto);

        const relations = await repository.connection('workspaces_grupos_relations').where({
            workspace_id: dto.id,
        });
        expect(relations).toEqual([]);
    });

    it('clears all workspace group relations when groups is explicitly empty', async () => {
        const groupId = await createGroup();
        const dto = await createWorkspaceDto({ groups: [{ id: groupId }] });
        await new WorkspaceCreator(repository).execute(dto);

        await new WorkspaceUpdater(repository).execute(
            {
                groups: [],
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            },
            dto.id
        );

        const relations = await repository.connection('workspaces_grupos_relations').where({
            workspace_id: dto.id,
        });
        expect(relations).toEqual([]);
    });

    it('preserves workspace group relations when groups is omitted from an update', async () => {
        const groupId = await createGroup();
        const dto = await createWorkspaceDto({ groups: [{ id: groupId }] });
        await new WorkspaceCreator(repository).execute(dto);

        await new WorkspaceUpdater(repository).execute(
            {
                description: 'Partial edit preserving groups',
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            },
            dto.id
        );

        const relations = await repository.connection('workspaces_grupos_relations').where({
            workspace_id: dto.id,
        });
        expect(relations).toEqual([{ workspace_id: dto.id, grupo_id: groupId }]);
    });

    it('persists one Channel Hub account relation for a workspace', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'single-relation@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: channelHubAccountId }],
        });

        await new WorkspaceCreator(repository).execute(dto);

        const relations = await repository.connection('workspaces_channel_hub_accounts_relations').where({
            workspace_id: dto.id,
        });
        expect(relations).toEqual([
            {
                workspace_id: dto.id,
                channel_hub_account_id: channelHubAccountId,
                channel_hub_rule_id: null,
            },
        ]);
    });

    it('persists and returns the Channel Hub rule id per account relation', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'rule-id@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'rule-xyz' }],
        });

        await new WorkspaceCreator(repository).execute(dto);

        const relations = await repository.connection('workspaces_channel_hub_accounts_relations').where({
            workspace_id: dto.id,
        });
        expect(relations).toEqual([
            {
                workspace_id: dto.id,
                channel_hub_account_id: channelHubAccountId,
                channel_hub_rule_id: 'rule-xyz',
            },
        ]);

        const workspace = await repository.find({ value: dto.id });
        expect(workspace.channel_hub_accounts.value).toHaveLength(1);
        expect(workspace.channel_hub_accounts.value[0]).toMatchObject({
            id: channelHubAccountId,
            channel_hub_rule_id: 'rule-xyz',
        });
    });

    it('returns a null Channel Hub rule id for an account linked but not yet registered', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'pending-rule@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: channelHubAccountId }],
        });

        await new WorkspaceCreator(repository).execute(dto);

        const workspace = await repository.find({ value: dto.id });
        expect(workspace.channel_hub_accounts.value[0]).toMatchObject({
            id: channelHubAccountId,
            channel_hub_rule_id: null,
        });
    });

    it('creates a workspace with several Channel Hub account relations, each with its own rule id state', async () => {
        const firstChannelHubAccountId = await createChannelHubAccount({ email: 'first-create@example.com' });
        const secondChannelHubAccountId = await createChannelHubAccount({ email: 'second-create@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [
                { id: firstChannelHubAccountId, channel_hub_rule_id: 'rule-first' },
                { id: secondChannelHubAccountId },
            ],
        });

        await new WorkspaceCreator(repository).execute(dto);

        const relations = await repository
            .connection('workspaces_channel_hub_accounts_relations')
            .where({ workspace_id: dto.id })
            .orderBy('channel_hub_account_id');
        expect(relations).toEqual(
            [
                {
                    workspace_id: dto.id,
                    channel_hub_account_id: firstChannelHubAccountId,
                    channel_hub_rule_id: 'rule-first',
                },
                {
                    workspace_id: dto.id,
                    channel_hub_account_id: secondChannelHubAccountId,
                    channel_hub_rule_id: null,
                },
            ].sort((a, b) => a.channel_hub_account_id.localeCompare(b.channel_hub_account_id))
        );
    });

    it('finds active Workspaces assigned to a Channel Hub account id and tag', async () => {
        const restFlowId = uuidV4();
        const channelHubAccountId = uuidV4();

        await repository.connection('ws_rest_flows').insert({ id: restFlowId });
        await repository.connection('channel_hub_accounts').insert({
            id: channelHubAccountId,
            email: 'routing@example.com',
            name: 'Routing Account',
            country_id: 'CO',
            operator_id: 'imap',
            rest_flow_id: restFlowId,
            channel_hub_connection_id: 'conn_routing',
            is_active: true,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
            updated_by: uuidV4(),
            updated_at: new Date().toISOString(),
        });

        const activeWorkspaceId = uuidV4();
        await new WorkspaceCreator(repository).execute({
            id: activeWorkspaceId,
            description: 'Active Routing Workspace',
            is_active: true,
            tag: 'target-tag',
            rules: null,
            mails_accounts: [],
            channel_hub_accounts: [{ id: channelHubAccountId }],
            groups: [],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });
        await new WorkspaceCreator(repository).execute({
            id: uuidV4(),
            description: 'Same Account Different Tag',
            is_active: true,
            tag: 'other-tag',
            rules: null,
            mails_accounts: [],
            channel_hub_accounts: [{ id: channelHubAccountId }],
            groups: [],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });
        await new WorkspaceCreator(repository).execute({
            id: uuidV4(),
            description: 'Inactive Target Workspace',
            is_active: false,
            tag: 'target-tag',
            rules: null,
            mails_accounts: [],
            channel_hub_accounts: [{ id: channelHubAccountId }],
            groups: [],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        const result = await repository.findActiveByChannelHubAccountIdAndTag(channelHubAccountId, 'target-tag');

        expect(result.map((workspace) => workspace.id.value)).toEqual([activeWorkspaceId]);
        expect(result[0].description.value).toBe('Active Routing Workspace');
    });

    it('includes the Channel Hub rule id per account when searching workspaces', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'search-rule@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'rule-search' }],
        });
        await new WorkspaceCreator(repository).execute(dto);

        const result = await new WorkspaceSearcher(repository).execute({
            filter: undefined,
            relationship: undefined,
            limit: 50,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        });

        const item = result.toJson().data.items.find((workspace) => workspace.id === dto.id);
        expect(item).toBeDefined();
        expect(item.channel_hub_accounts[0]).toMatchObject({
            id: channelHubAccountId,
            channel_hub_rule_id: 'rule-search',
        });
    });

    it('finds the stable workspace rule mappings for a Channel Hub account', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'priority-mappings@example.com' });
        const workspace = await createWorkspaceDto({
            description: 'Priority Mapping Workspace',
            tag: 'priority-mapping',
            channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'rule-priority-mapping' }],
        });
        await new WorkspaceCreator(repository).execute(workspace);

        const result = await repository.findChannelHubPriorityMappingsByAccountId(channelHubAccountId);

        expect(result).toEqual([
            {
                workspaceId: workspace.id,
                description: 'Priority Mapping Workspace',
                tag: 'priority-mapping',
                ruleId: 'rule-priority-mapping',
            },
        ]);
    });

    it('excludes inactive Workspaces from a Channel Hub Account processing order', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'active-priority-mappings@example.com' });
        const activeWorkspace = await createWorkspaceDto({
            description: 'Active Priority Workspace',
            tag: 'active-priority',
            is_active: true,
            channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'rule-active-priority' }],
        });
        const inactiveWorkspace = await createWorkspaceDto({
            description: 'Inactive Priority Workspace',
            tag: 'inactive-priority',
            is_active: false,
            channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'rule-inactive-priority' }],
        });
        await new WorkspaceCreator(repository).execute(activeWorkspace);
        await new WorkspaceCreator(repository).execute(inactiveWorkspace);

        const result = await repository.findChannelHubPriorityMappingsByAccountId(channelHubAccountId);

        expect(result).toEqual([
            {
                workspaceId: activeWorkspace.id,
                description: 'Active Priority Workspace',
                tag: 'active-priority',
                ruleId: 'rule-active-priority',
            },
        ]);
    });

    it('finds the default INBOX workspace by fixed id', async () => {
        const workspace = await repository.findDefaultInboxWorkspace();

        expect(workspace).not.toBeNull();
        expect(workspace.id.value).toBe(DEFAULT_INBOX_WORKSPACE_ID);
        expect(workspace.description.value).toBe('INBOX');
    });

    it('persists selected Tag REST Flows for a workspace', async () => {
        const tagCreationFlowId = uuidV4();
        const tagUpdateFlowId = uuidV4();
        const tagDeletionFlowId = uuidV4();

        await repository.connection('ws_rest_flows').insert([
            { id: tagCreationFlowId, description: 'Channel Hub - Crear tag', is_active: true },
            { id: tagUpdateFlowId, description: 'Channel Hub - Actualizar tag', is_active: true },
            { id: tagDeletionFlowId, description: 'Channel Hub - Eliminar tag', is_active: true },
        ]);

        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'tag-rest-flows',
            rules: { notifications: true },
            mails_accounts: [],
            channel_hub_accounts: [{ id: await createChannelHubAccount({ email: 'tag-flows@example.com' }) }],
            groups: [],
            tag_creation_flow_id: tagCreationFlowId,
            tag_update_flow_id: tagUpdateFlowId,
            tag_deletion_flow_id: tagDeletionFlowId,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };

        await new WorkspaceCreator(repository).execute(dto);
        const workspace = await new WorkspaceFinder(repository).execute(dto.id);

        expect(workspace.toJson().data).toMatchObject({
            tag_creation_flow_id: tagCreationFlowId,
            tag_update_flow_id: tagUpdateFlowId,
            tag_deletion_flow_id: tagDeletionFlowId,
        });
    });

    it('return null if not found a record', async () => {
        const groupFinder = new WorkspaceFinder(repository);

        await expect(groupFinder.execute(uuidV4())).rejects.toThrow(CustomError);
    });

    it('updates an existing Workspace instance', async () => {
        const originalMailId = uuidV4();
        await repository.connection('mail_accounts').insert({
            id: originalMailId,
            description: 'Original Mail Account',
            type: 'imap',
            // `mail_accounts.is_active` es la antigua columna `status`: integer.
            is_active: 1,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'original-tag',
            rules: { auto_assign: true },
            mails_accounts: [{ id: originalMailId }],
            channel_hub_accounts: [{ id: await createChannelHubAccount({ email: 'update-workspace@example.com' }) }],
            groups: [],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };
        const workspaceCreator = new WorkspaceCreator(repository);
        await workspaceCreator.execute(dto);

        const updatedMailId = uuidV4();
        await repository.connection('mail_accounts').insert({
            id: updatedMailId,
            description: 'Updated Mail Account',
            type: 'smtp',
            // `mail_accounts.is_active` es la antigua columna `status`: integer.
            is_active: 1,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        const workspaceUpdater = new WorkspaceUpdater(repository);
        const dtoUpdate = {
            description: 'Nuevo nombre actualizado',
            // `workspaces.is_active` es boolean en postgres, no la columna entera de mail_accounts.
            is_active: false,
            tag: 'updated-tag',
            rules: { auto_assign: false, priority: 'low' },
            mails_accounts: [updatedMailId],
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        await workspaceUpdater.execute(dtoUpdate, dto.id);
        const result = await repository.find({ value: dto.id });

        expect(result).toBeInstanceOf(Workspaces);
        expect(result.description.value).toEqual(dtoUpdate.description);
        expect(result.is_active.value).toEqual(dtoUpdate.is_active);
        expect(result.tag.value).toEqual(dtoUpdate.tag);
        expect(result.rules.value).toEqual(dtoUpdate.rules);
        expect(result.updated_at.value).toEqual(dtoUpdate.updated_at);
        expect(result.updated_by.value).toEqual(dtoUpdate.updated_by);
        expect(Array.isArray(result.mails_accounts.value)).toBe(true);
        expect(result.mails_accounts.value.length).toBe(1);
        expect(result.mails_accounts.value[0]).toHaveProperty('id', updatedMailId);
        expect(result.mails_accounts.value[0]).toHaveProperty('description', 'Updated Mail Account');
    });

    it('replaces selected Channel Hub accounts and groups when updating a workspace', async () => {
        const originalRestFlowId = uuidV4();
        const updatedRestFlowId = uuidV4();
        const originalChannelHubAccountId = uuidV4();
        const updatedChannelHubAccountId = uuidV4();
        const originalGroupId = uuidV4();
        const updatedGroupId = uuidV4();

        await repository.connection('ws_rest_flows').insert([{ id: originalRestFlowId }, { id: updatedRestFlowId }]);
        await repository.connection('channel_hub_accounts').insert([
            {
                id: originalChannelHubAccountId,
                email: 'original@example.com',
                name: 'Original',
                country_id: 'CO',
                operator_id: 'imap',
                rest_flow_id: originalRestFlowId,
                channel_hub_connection_id: null,
                is_active: true,
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
                updated_by: uuidV4(),
                updated_at: new Date().toISOString(),
            },
            {
                id: updatedChannelHubAccountId,
                email: 'updated@example.com',
                name: 'Updated',
                country_id: 'CO',
                operator_id: 'imap',
                rest_flow_id: updatedRestFlowId,
                channel_hub_connection_id: null,
                is_active: true,
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
                updated_by: uuidV4(),
                updated_at: new Date().toISOString(),
            },
        ]);
        await repository.connection('grupos').insert([
            {
                id: originalGroupId,
                nombre: 'Original Group',
                status: 1,
                descripcion: 'Original group',
            },
            {
                id: updatedGroupId,
                nombre: 'Updated Group',
                status: 1,
                descripcion: 'Updated group',
            },
        ]);

        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'original-channel-tag',
            rules: { auto_assign: true },
            mails_accounts: [],
            channel_hub_accounts: [{ id: originalChannelHubAccountId }],
            groups: [{ id: originalGroupId }],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };
        await new WorkspaceCreator(repository).execute(dto);

        const dtoUpdate = {
            description: 'Workspace with updated relations',
            is_active: true,
            tag: 'updated-channel-tag',
            rules: { auto_assign: false },
            channel_hub_accounts: [{ id: updatedChannelHubAccountId }],
            groups: [{ id: updatedGroupId }],
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        await new WorkspaceUpdater(repository).execute(dtoUpdate, dto.id);
        const result = await repository.find({ value: dto.id });

        expect(result.channel_hub_accounts.value).toHaveLength(1);
        expect(result.channel_hub_accounts.value[0]).toMatchObject({
            id: updatedChannelHubAccountId,
            email: 'updated@example.com',
            name: 'Updated',
        });
        expect(result.groups.value).toHaveLength(1);
        expect(result.groups.value[0]).toMatchObject({
            id: updatedGroupId,
            nombre: 'Updated Group',
        });
    });

    it('rejects updating a Workspace to remove every Channel Hub account', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'remove-all-update@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: channelHubAccountId }],
        });
        await new WorkspaceCreator(repository).execute(dto);

        await expect(
            new WorkspaceUpdater(repository).execute(
                {
                    description: 'Invalid zero-account update',
                    channel_hub_accounts: [],
                    updated_at: new Date().toISOString(),
                    updated_by: uuidV4(),
                },
                dto.id
            )
        ).rejects.toThrow(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED_MESSAGE);
    });

    it('rejects unrelated updates to legacy Workspaces that have no Channel Hub account', async () => {
        const workspaceId = uuidV4();
        await repository.connection('workspaces').insert({
            id: workspaceId,
            description: `legacy-${uuidV4()}`,
            is_active: true,
            tag: `legacy-${uuidV4()}`,
            rules: JSON.stringify({ legacy: true }),
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        try {
            await new WorkspaceUpdater(repository).execute(
                {
                    description: 'Legacy workspace edit',
                    updated_at: new Date().toISOString(),
                    updated_by: uuidV4(),
                },
                workspaceId
            );
            throw new Error('Expected WorkspaceUpdater to reject a legacy Workspace with no Channel Hub account');
        } catch (error) {
            expect(error.message).toBe(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED_MESSAGE);
            expect(error.publicErrorCode).toBe(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED);
        }
    });

    it('preserves the existing Channel Hub rule id when an update does not resend it', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'preserve-rule@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'rule-keep' }],
        });
        await new WorkspaceCreator(repository).execute(dto);

        // The frontend edits the workspace and resends the account WITHOUT its rule id.
        await new WorkspaceUpdater(repository).execute(
            {
                description: 'Edited without resending rule id',
                is_active: true,
                channel_hub_accounts: [{ id: channelHubAccountId }],
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            },
            dto.id
        );

        const relations = await repository.connection('workspaces_channel_hub_accounts_relations').where({
            workspace_id: dto.id,
        });
        expect(relations).toEqual([
            {
                workspace_id: dto.id,
                channel_hub_account_id: channelHubAccountId,
                channel_hub_rule_id: 'rule-keep',
            },
        ]);
    });

    it('atomically clears relation and legacy Channel Hub rule ids when deactivating', async () => {
        const firstChannelHubAccountId = await createChannelHubAccount({ email: 'deactivate-first@example.com' });
        const secondChannelHubAccountId = await createChannelHubAccount({ email: 'deactivate-second@example.com' });
        const dto = await createWorkspaceDto({
            rules: { ruleId: 'legacy-rule-id', ruleName: 'Support' },
            channel_hub_accounts: [
                { id: firstChannelHubAccountId, channel_hub_rule_id: 'rule-first' },
                { id: secondChannelHubAccountId, channel_hub_rule_id: 'rule-second' },
            ],
        });
        await new WorkspaceCreator(repository).execute(dto);

        await new WorkspaceDeactivator(repository).execute(
            {
                is_active: false,
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            },
            dto.id
        );

        const persistedWorkspace = await repository.find({ value: dto.id });
        const relations = await repository
            .connection('workspaces_channel_hub_accounts_relations')
            .where({ workspace_id: dto.id })
            .orderBy('channel_hub_account_id');

        expect(persistedWorkspace.is_active.value).toBe(false);
        expect(persistedWorkspace.rules.value).toEqual({ ruleName: 'Support' });
        expect(relations).toHaveLength(2);
        expect(relations.every((relation) => relation.channel_hub_rule_id === null)).toBe(true);
    });

    it('keeps relation and legacy Channel Hub rule ids during an ordinary inactive workspace edit', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'inactive-edit@example.com' });
        const dto = await createWorkspaceDto({
            is_active: false,
            rules: { ruleId: 'legacy-rule-keep', ruleName: 'Support' },
            channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'relation-rule-keep' }],
        });
        await new WorkspaceCreator(repository).execute(dto);

        await new WorkspaceUpdater(repository).execute(
            {
                description: 'Edited while still inactive',
                is_active: false,
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            },
            dto.id
        );

        const persistedWorkspace = await repository.find({ value: dto.id });
        const relation = await repository
            .connection('workspaces_channel_hub_accounts_relations')
            .where({ workspace_id: dto.id })
            .first();

        expect(persistedWorkspace.rules.value.ruleId).toBe('legacy-rule-keep');
        expect(relation.channel_hub_rule_id).toBe('relation-rule-keep');
    });

    it('overwrites the Channel Hub rule id when an update resends a new one', async () => {
        const channelHubAccountId = await createChannelHubAccount({ email: 'overwrite-rule@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'rule-old' }],
        });
        await new WorkspaceCreator(repository).execute(dto);

        await new WorkspaceUpdater(repository).execute(
            {
                description: 'Edited resending a new rule id',
                is_active: true,
                channel_hub_accounts: [{ id: channelHubAccountId, channel_hub_rule_id: 'rule-new' }],
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            },
            dto.id
        );

        const relations = await repository.connection('workspaces_channel_hub_accounts_relations').where({
            workspace_id: dto.id,
        });
        expect(relations[0].channel_hub_rule_id).toBe('rule-new');
    });

    it('updates a workspace to several Channel Hub accounts preserving the retained account rule id', async () => {
        const originalChannelHubAccountId = await createChannelHubAccount({ email: 'original-update@example.com' });
        const addedChannelHubAccountId = await createChannelHubAccount({ email: 'added-update@example.com' });
        const dto = await createWorkspaceDto({
            channel_hub_accounts: [{ id: originalChannelHubAccountId, channel_hub_rule_id: 'rule-original' }],
        });
        await new WorkspaceCreator(repository).execute(dto);

        await new WorkspaceUpdater(repository).execute(
            {
                description: 'Multi account update',
                is_active: true,
                channel_hub_accounts: [{ id: originalChannelHubAccountId }, { id: addedChannelHubAccountId }],
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            },
            dto.id
        );

        const relations = await repository
            .connection('workspaces_channel_hub_accounts_relations')
            .where({ workspace_id: dto.id })
            .orderBy('channel_hub_account_id');
        expect(relations).toEqual(
            [
                {
                    workspace_id: dto.id,
                    channel_hub_account_id: originalChannelHubAccountId,
                    channel_hub_rule_id: 'rule-original',
                },
                {
                    workspace_id: dto.id,
                    channel_hub_account_id: addedChannelHubAccountId,
                    channel_hub_rule_id: null,
                },
            ].sort((a, b) => a.channel_hub_account_id.localeCompare(b.channel_hub_account_id))
        );
    });

    it('allows the same Channel Hub account to be assigned to two different workspaces', async () => {
        const sharedChannelHubAccountId = await createChannelHubAccount({ email: 'shared@example.com' });
        const juanfers = await createWorkspaceDto({
            description: `workspaceJuanfers-${uuidV4()}`,
            tag: 'juanfer',
            channel_hub_accounts: [{ id: sharedChannelHubAccountId }],
        });
        const luigui = await createWorkspaceDto({
            description: `workspaceLuigui-${uuidV4()}`,
            tag: 'nintendo',
            channel_hub_accounts: [{ id: sharedChannelHubAccountId }],
        });

        await new WorkspaceCreator(repository).execute(juanfers);
        await new WorkspaceCreator(repository).execute(luigui);

        const relations = await repository.connection('workspaces_channel_hub_accounts_relations').where({
            channel_hub_account_id: sharedChannelHubAccountId,
        });
        expect(relations.map((relation) => relation.workspace_id).sort()).toEqual([juanfers.id, luigui.id].sort());
    });

    it('updates and clears selected Tag REST Flows for a workspace', async () => {
        const originalCreationFlowId = uuidV4();
        const originalUpdateFlowId = uuidV4();
        const originalDeletionFlowId = uuidV4();
        const replacementCreationFlowId = uuidV4();

        await repository.connection('ws_rest_flows').insert([
            { id: originalCreationFlowId, description: 'Original create tag flow', is_active: true },
            { id: originalUpdateFlowId, description: 'Original update tag flow', is_active: true },
            { id: originalDeletionFlowId, description: 'Original delete tag flow', is_active: true },
            { id: replacementCreationFlowId, description: 'Replacement create tag flow', is_active: true },
        ]);

        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'original-tag-flow',
            rules: { auto_assign: true },
            mails_accounts: [],
            channel_hub_accounts: [{ id: await createChannelHubAccount({ email: 'update-tag-flows@example.com' }) }],
            groups: [],
            tag_creation_flow_id: originalCreationFlowId,
            tag_update_flow_id: originalUpdateFlowId,
            tag_deletion_flow_id: originalDeletionFlowId,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };
        await new WorkspaceCreator(repository).execute(dto);

        await new WorkspaceUpdater(repository).execute(
            {
                description: 'Workspace with updated tag flows',
                is_active: true,
                tag_creation_flow_id: replacementCreationFlowId,
                tag_update_flow_id: null,
                tag_deletion_flow_id: null,
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            },
            dto.id
        );

        const result = await repository.find({ value: dto.id });

        expect(result.tag_creation_flow_id.value).toBe(replacementCreationFlowId);
        expect(result.tag_update_flow_id.value).toBeNull();
        expect(result.tag_deletion_flow_id.value).toBeNull();
    });

    it('should return an error when update a non-existent Workspaces instance', async () => {
        const workspaceUpdater = new WorkspaceUpdater(repository);
        await expect(workspaceUpdater.execute({ is_active: true }, uuidV4())).rejects.toThrow(CustomError);
    });

    it('deletes an existing Workspaces instance by id', async () => {
        const dto = {
            id: uuidV4(),
            description: `TEST-${uuidV4()}`,
            is_active: true,
            tag: 'delete-tag',
            rules: { auto_delete: true },
            mails_accounts: [],
            channel_hub_accounts: [{ id: await createChannelHubAccount({ email: 'delete-workspace@example.com' }) }],
            groups: [],
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };
        const workspaceCreator = new WorkspaceCreator(repository);
        await workspaceCreator.execute(dto);
        const workspaceDeleter = new WorkspaceDeleter(repository);

        const deleteDto = {
            ...dto,
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        await workspaceDeleter.execute(dto.id, deleteDto);

        const result = await repository.find({ value: dto.id });

        expect(result).toBeNull();
    });

    it('should return an error when delete a non-existent Workspace instance', async () => {
        const workspaceDeleter = new WorkspaceDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        await expect(workspaceDeleter.execute(uuidV4(), deleteDto)).rejects.toThrow(CustomError);
    });

    it('searches for Workspaces instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            const dto = {
                id: uuidV4(),
                description: `Workspace ${i}`,
                is_active: true,
                tag: `tag-${i}`,
                rules: { index: i },
                mails_accounts: [],
                channel_hub_accounts: [{ id: await createChannelHubAccount({ email: `search-${i}@example.com` }) }],
                groups: [],
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            };
            const workspaceCreator = new WorkspaceCreator(repository);
            await workspaceCreator.execute(dto);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const workspacesearcher = new WorkspaceSearcher(repository);

        const workspaceResult = await workspacesearcher.execute(dtoCriteria);

        expect(workspaceResult).toBeInstanceOf(WorkspaceCollectionResponse);
    });

    it('should return an error when not exist field is filtered', async () => {
        for (let i = 0; i < 10; i++) {
            const dto = {
                id: uuidV4(),
                description: `Workspace ${i}`,
                is_active: true,
                tag: `error-tag-${i}`,
                rules: {},
                mails_accounts: [],
                channel_hub_accounts: [
                    { id: await createChannelHubAccount({ email: `filter-error-${i}@example.com` }) },
                ],
                groups: [],
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            };
            const workspaceCreator = new WorkspaceCreator(repository);
            await workspaceCreator.execute(dto);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'not_exist',
                    operator: 'eq',
                    value: 'value',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        await expect(new WorkspaceSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of Workspaces instances', async () => {
        for (let i = 0; i < 10; i++) {
            const dto = {
                id: uuidV4(),
                description: `Workspace ${i}`,
                is_active: true,
                tag: `count-tag-${i}`,
                rules: { counter: i },
                mails_accounts: [],
                channel_hub_accounts: [{ id: await createChannelHubAccount({ email: `count-${i}@example.com` }) }],
                groups: [],
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            };
            const workspaceCreator = new WorkspaceCreator(repository);
            await workspaceCreator.execute(dto);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const workspaceCounter = new WorkspacesCounter(repository);

        const workspaceResult = await workspaceCounter.execute(dtoCriteria);

        expect(Number(workspaceResult.count)).toBe(11);
    });

    it('should return a zero for not found criteria', async () => {
        for (let i = 0; i < 10; i++) {
            const dto = {
                id: uuidV4(),
                description: `Workspace ${i}`,
                is_active: true,
                tag: `zero-tag-${i}`,
                rules: { empty: true },
                mails_accounts: [],
                channel_hub_accounts: [{ id: await createChannelHubAccount({ email: `zero-${i}@example.com` }) }],
                groups: [],
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            };
            const workspaceCreator = new WorkspaceCreator(repository);
            await workspaceCreator.execute(dto);
        }
        const dtoCriteria = {
            // El filtro original comparaba `is_active` (boolean en postgres) con
            // '10' y reventaba el conteo en vez de no encontrar nada.
            filter: [
                {
                    field: 'description',
                    operator: 'eq',
                    value: `sin-coincidencias-${uuidV4()}`,
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const workspaceConuter = new WorkspacesCounter(repository);

        const workspaceResult = await workspaceConuter.execute(dtoCriteria);

        expect(Number(workspaceResult.count)).toBe(0);
    });
});
