import { describe, expect, it } from '@jest/globals';
import { WorkspaceDeactivationApplication } from '../../../src/workspaces/application/update/WorkspaceDeactivationApplication.js';

const WORKSPACE_ID = '95346f17-4ee8-420d-a0af-16d2ac394dd9';

class WorkspaceRepositoryFake {
    workspace = null;
    lookups = [];

    async find(id) {
        this.lookups.push(id);
        return this.workspace;
    }
}

class RemoteTagDeactivatorFake {
    calls = [];
    failure = null;

    async execute(workspace, options) {
        this.calls.push({ workspace, options });
        if (this.failure) throw this.failure;
    }
}

class LocalWorkspaceDeactivatorFake {
    calls = [];

    async execute(update, workspaceId) {
        this.calls.push({ update, workspaceId });
    }
}

const previousWorkspace = {
    id: WORKSPACE_ID,
    is_active: true,
    tag_deletion_flow_id: 'deletion-flow-id',
    channel_hub_accounts: [],
    rules: {},
};

const createApplication = () => {
    const workspaceRepository = new WorkspaceRepositoryFake();
    workspaceRepository.workspace = previousWorkspace;
    const remoteDeactivator = new RemoteTagDeactivatorFake();
    const localDeactivator = new LocalWorkspaceDeactivatorFake();
    const targets = [{ channel_hub_account_id: 'account-1', connectionId: 'connection-1', ruleId: 'rule-1' }];
    const application = new WorkspaceDeactivationApplication({
        workspaceRepository,
        serializeWorkspace: (workspace) => workspace,
        targetResolver: () => targets,
        remoteDeactivator,
        localDeactivator,
    });

    return {
        application,
        workspaceRepository,
        remoteDeactivator,
        localDeactivator,
        targets,
    };
};

describe('WorkspaceDeactivationApplication', () => {
    it('deletes remote rules before finalizing an active workspace deactivation', async () => {
        const context = createApplication();
        const update = { is_active: false, updated_by: 'user-id' };

        await expect(context.application.execute(WORKSPACE_ID, update)).resolves.toBe(true);

        expect(context.workspaceRepository.lookups).toEqual([{ value: WORKSPACE_ID }]);
        expect(context.remoteDeactivator.calls).toEqual([
            { workspace: previousWorkspace, options: { targets: context.targets } },
        ]);
        expect(context.localDeactivator.calls).toEqual([{ update, workspaceId: WORKSPACE_ID }]);
    });

    it('never finalizes local inactivity when remote deletion fails', async () => {
        const context = createApplication();
        context.remoteDeactivator.failure = new Error('remote deletion failed');

        await expect(context.application.execute(WORKSPACE_ID, { is_active: false })).rejects.toThrow(
            'remote deletion failed'
        );
        expect(context.localDeactivator.calls).toEqual([]);
    });

    it('rejects active edits and persists accompanying edits on already-inactive workspaces', async () => {
        const activeEdit = createApplication();
        await expect(
            activeEdit.application.execute(WORKSPACE_ID, { is_active: true, description: 'Still active' })
        ).resolves.toBe(false);
        expect(activeEdit.remoteDeactivator.calls).toEqual([]);

        const inactiveEdit = createApplication();
        inactiveEdit.workspaceRepository.workspace = { ...previousWorkspace, is_active: false };
        const update = { is_active: false, description: 'Edited while inactive' };
        await expect(inactiveEdit.application.execute(WORKSPACE_ID, update)).resolves.toBe(true);
        expect(inactiveEdit.remoteDeactivator.calls).toEqual([]);
        expect(inactiveEdit.localDeactivator.calls).toEqual([{ update, workspaceId: WORKSPACE_ID }]);
    });

    it('uses a supplied snapshot without reloading the workspace', async () => {
        const context = createApplication();
        const snapshot = { ...previousWorkspace };
        const update = { is_active: false, updated_by: 'user-id' };

        await expect(context.application.execute(WORKSPACE_ID, update, snapshot)).resolves.toBe(true);

        expect(context.workspaceRepository.lookups).toEqual([]);
        expect(context.remoteDeactivator.calls).toEqual([
            { workspace: snapshot, options: { targets: context.targets } },
        ]);
        expect(context.localDeactivator.calls).toEqual([{ update, workspaceId: WORKSPACE_ID }]);
    });
});
