import { describe, expect, it } from '@jest/globals';
import { WorkspaceDeletionApplication } from '../src/WorkspaceDeletionApplication.mjs';

const WORKSPACE_ID = '95346f17-4ee8-420d-a0af-16d2ac394dd9';

class TagFlowQueuerFake {
    calls = [];
    failure = null;

    constructor(events) {
        this.events = events;
    }

    async execute(workspaceId, action) {
        this.calls.push({ workspaceId, action });
        this.events.push('remote-delete');
        if (this.failure) throw this.failure;
    }
}

class WorkspaceDeleterFake {
    calls = [];

    constructor(events) {
        this.events = events;
    }

    async execute(workspaceId, deletion) {
        this.calls.push({ workspaceId, deletion });
        this.events.push('local-delete');
    }
}

describe('WorkspaceDeletionApplication', () => {
    it('runs the remote deletion flow before deleting the local workspace', async () => {
        const events = [];
        const tagFlowQueuer = new TagFlowQueuerFake(events);
        const workspaceDeleter = new WorkspaceDeleterFake(events);
        const application = new WorkspaceDeletionApplication({ tagFlowQueuer, workspaceDeleter });
        const deletion = { deleted_by: 'user-id', deleted_at: '2026-08-19T12:00:00.000Z' };

        await application.execute(WORKSPACE_ID, deletion);

        expect(tagFlowQueuer.calls).toEqual([{ workspaceId: WORKSPACE_ID, action: 'delete' }]);
        expect(workspaceDeleter.calls).toEqual([{ workspaceId: WORKSPACE_ID, deletion }]);
        expect(events).toEqual(['remote-delete', 'local-delete']);
    });

    it('does not delete the local workspace when the remote deletion flow fails', async () => {
        const events = [];
        const tagFlowQueuer = new TagFlowQueuerFake(events);
        tagFlowQueuer.failure = new Error('remote deletion failed');
        const workspaceDeleter = new WorkspaceDeleterFake(events);
        const application = new WorkspaceDeletionApplication({ tagFlowQueuer, workspaceDeleter });

        await expect(application.execute(WORKSPACE_ID, {})).rejects.toThrow('remote deletion failed');
        expect(workspaceDeleter.calls).toEqual([]);
    });
});
