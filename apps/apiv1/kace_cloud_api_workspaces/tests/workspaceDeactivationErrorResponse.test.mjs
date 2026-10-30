import { describe, expect, it } from '@jest/globals';
import {
    WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
    WORKSPACE_CHANNEL_HUB_TAG_DELETION_FLOW_REQUIRED,
} from '@kace/error-codes';
import { WorkspaceChannelHubTagDeactivatorError } from '../src/WorkspaceChannelHubTagDeactivator.mjs';
import { workspaceDeactivationErrorResponse } from '../src/workspaceDeactivationErrorResponse.mjs';

const eventFixture = () => ({
    headers: { origin: 'https://admin.appsmx.net' },
    httpMethod: 'PUT',
    resource: '/{id}',
    tenantContext: {
        tenant: {
            apps_allowed_origins: { value: 'https://admin.appsmx.net' },
            apps_debug: { value: 'true' },
        },
    },
});

describe('workspace deactivation public error boundary', () => {
    it('returns only the stable public code when remote deletion fails', () => {
        const error = new WorkspaceChannelHubTagDeactivatorError(
            'provider host=private.internal token=do-not-return',
            502,
            { connection_id: 'private-connection-id' },
            WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED
        );

        const response = workspaceDeactivationErrorResponse(error, eventFixture()).toJson();

        expect(response.statusCode).toBe(502);
        expect(JSON.parse(response.body).data.code).toBe(WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED);
        expect(response.body).not.toContain('private.internal');
        expect(response.body).not.toContain('private-connection-id');
    });

    it('reports a missing deletion flow as a safe conflict', () => {
        const error = new WorkspaceChannelHubTagDeactivatorError(
            'Workspace has no tag deletion flow assigned',
            409,
            { workspace_id: 'private-workspace-id' },
            WORKSPACE_CHANNEL_HUB_TAG_DELETION_FLOW_REQUIRED
        );

        const response = workspaceDeactivationErrorResponse(error, eventFixture()).toJson();

        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).data.code).toBe(WORKSPACE_CHANNEL_HUB_TAG_DELETION_FLOW_REQUIRED);
        expect(response.body).not.toContain('private-workspace-id');
    });

    it('declines errors outside the workspace deactivation boundary', () => {
        expect(workspaceDeactivationErrorResponse(new Error('other failure'), eventFixture())).toBeNull();
    });
});
