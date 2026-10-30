import { beforeEach, describe, expect, it } from '@jest/globals';
import { SERVICE_MANIFEST } from '../../../../packages/kace_cloud_local_server/src/service-manifest.mjs';
import { createBaseHandler } from '../src/handler.mjs';

const calls = [];

class FakeController {
    constructor(event, knexConfig) {
        this.event = event;
        calls.push({ action: 'construct', event, knexConfig });
    }

    async runWorkspacePriorities() {
        calls.push({ action: 'workspace-priorities' });
        return { toJson: () => ({ statusCode: 200, body: '{"data":[]}' }) };
    }

    async runWorkspacePriorityReorderStatus() {
        calls.push({ action: 'reorder-status' });
        return { toJson: () => ({ statusCode: 200, body: '{"data":{"status":"pending"}}' }) };
    }

    async runRegister() {
        calls.push({ action: 'register' });
        return { toJson: () => ({ statusCode: 200, body: '{}' }) };
    }

    async run() {
        calls.push({ action: 'standard-route', method: this.event.httpMethod });
        return { toJson: () => ({ statusCode: 200, body: '{}' }) };
    }
}

class FakeRegisterController extends FakeController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        calls.push({ action: 'register-controller' });
    }
}

const dedicatedController = (action) =>
    class extends FakeController {
        constructor(event, knexConfig) {
            super(event, knexConfig);
            calls.push({ action });
        }
    };

const FakeWorkspacePriorityListController = dedicatedController('priority-list-controller');
const FakeWorkspacePriorityReorderController = dedicatedController('priority-reorder-controller');
const FakeWorkspacePriorityReorderStatusController = dedicatedController('priority-status-controller');

const handler = createBaseHandler({
    ControllerClass: FakeController,
    RegisterControllerClass: FakeRegisterController,
    WorkspacePriorityListControllerClass: FakeWorkspacePriorityListController,
    WorkspacePriorityReorderControllerClass: FakeWorkspacePriorityReorderController,
    WorkspacePriorityReorderStatusControllerClass: FakeWorkspacePriorityReorderStatusController,
});

describe('Channel Hub API handler', () => {
    beforeEach(() => {
        calls.length = 0;
    });

    it('keeps the local server manifest aligned with the reorder status route', () => {
        const channelHubService = SERVICE_MANIFEST.find(({ directory }) => directory === 'kace_cloud_api_channel_hub');

        expect(channelHubService?.customRoutes).toContainEqual({
            method: 'GET',
            resource: '/{id}/workspace-priorities/reorders/{operationId}',
        });
    });

    it('dispatches the workspace-priorities GET route to its custom controller path', async () => {
        const event = {
            tenantContext: { knexConfig: { client: 'mock' } },
            resource: '/{id}/workspace-priorities',
            httpMethod: 'GET',
            pathParameters: { id: 'account-id' },
        };

        const result = await handler(event);

        expect(event.resource).toBe('/{id}/workspace-priorities');
        expect(calls.find(({ action }) => action === 'construct')?.event.resource).toBe('/{id}');
        expect(calls.map(({ action }) => action)).toEqual(['construct', 'priority-list-controller', 'standard-route']);
        expect(result).toEqual({ statusCode: 200, body: '{}' });
    });

    it('dispatches POST reorder through a dedicated controller run seam', async () => {
        const event = {
            tenantContext: { knexConfig: { client: 'mock' } },
            resource: '/{id}/workspace-priorities/reorder',
            httpMethod: 'POST',
            pathParameters: { id: 'account-id' },
            body: '{"revision":"current","orderedWorkspaceIds":[]}',
        };

        await handler(event);

        expect(calls.map(({ action }) => action)).toEqual([
            'construct',
            'priority-reorder-controller',
            'standard-route',
        ]);
        expect(event.resource).toBe('/{id}/workspace-priorities/reorder');
        expect(calls.find(({ action }) => action === 'construct')?.event.resource).toBe('/');
    });

    it('dispatches reorder status reads to the operation controller path', async () => {
        const event = {
            tenantContext: { knexConfig: { client: 'mock' } },
            resource: '/{id}/workspace-priorities/reorders/{operationId}',
            httpMethod: 'GET',
            pathParameters: { id: 'account-id', operationId: 'operation-id' },
        };

        const result = await handler(event);

        expect(event.resource).toBe('/{id}/workspace-priorities/reorders/{operationId}');
        expect(calls.find(({ action }) => action === 'construct')?.event.resource).toBe('/{id}');
        expect(calls.map(({ action }) => action)).toEqual([
            'construct',
            'priority-status-controller',
            'standard-route',
        ]);
        expect(result).toEqual({ statusCode: 200, body: '{}' });
    });

    it('preserves register and legacy delete route semantics', async () => {
        const registerEvent = {
            tenantContext: { knexConfig: { client: 'mock' } },
            resource: '/{id}/register',
            httpMethod: 'POST',
        };
        await handler(registerEvent);
        expect(registerEvent.resource).toBe('/{id}/register');
        expect(calls.find(({ action }) => action === 'construct')?.event.resource).toBe('/');
        expect(calls.map(({ action }) => action)).toEqual(['construct', 'register-controller', 'standard-route']);

        calls.length = 0;
        const deleteEvent = {
            tenantContext: { knexConfig: { client: 'mock' } },
            resource: '/{id}/delete',
            httpMethod: 'POST',
        };
        await handler(deleteEvent);
        expect(deleteEvent.httpMethod).toBe('POST');
        expect(calls.find(({ action }) => action === 'construct')?.event.httpMethod).toBe('GET');
        expect(calls.map(({ action }) => action)).toEqual(['construct', 'standard-route']);
    });
});
