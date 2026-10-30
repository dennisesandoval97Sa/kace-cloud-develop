import { jest } from '@jest/globals';
const { BaseController } = await import('@kace/api-common/src/controllers/BaseController.js');
const { AvailableController } = await import('../src/AvailableController.mjs');
const { RegisterChannelHubTagsController } = await import('../src/RegisterChannelHubTagsController.mjs');
const { DeactivateController } = await import('../src/DeactivateController.mjs');
const { Controller } = await import('../src/Controller.mjs');
const { WorkspaceChannelHubTagRegistrar } = await import('../src/WorkspaceChannelHubTagRegistrar.mjs');
const { User } = await import('@kace/core/src/users/domain/User.js');
const { StatusEnum, AccountTypeEnum } = await import('@kace/core/src/shared/index.js');

const TENANT_SCHEMA = 'tenant_schema';
const USER_ID = '3db4b68d-2bf7-44db-8c4c-740b77d7ab55';

function eventFor(resource = '/') {
    return {
        httpMethod: 'GET',
        resource,
        pathParameters: { id: '95346f17-4ee8-420d-a0af-16d2ac394dd9' },
        body: '{}',
        headers: {
            Host: 'api.example.com',
            'X-Client-Fingerprint': 'current-fingerprint',
        },
        tenantContext: {
            tenant: {
                id: { value: 'tenant-id' },
                aws_cognito_user_pool_id: { value: 'us-east-1_TestPool' },
                aws_cognito_app_client_id: { value: 'client-id' },
                apps_execute_rest_hook_service_url: { value: 'https://api.example.com' },
                apps_service_name: { value: 'DEVELOPMENT' },
                aws_sqs_region: { value: 'us-east-1' },
                aws_event_bridge_event_bus_name: { value: 'test-bus' },
                aws_cases_events_queue_url: { value: 'https://sqs.us-east-1.amazonaws.com/123/cases' },
                aws_action_jobs_events_queue_url: { value: 'https://sqs.us-east-1.amazonaws.com/123/action-jobs' },
                aws_automated_actions_events_queue_url: {
                    value: 'https://sqs.us-east-1.amazonaws.com/123/automated-actions',
                },
                aws_ws_rest_events_queue_url: { value: 'https://sqs.us-east-1.amazonaws.com/123/ws-rest' },
                aws_reports_events_queue_url: { value: 'https://sqs.us-east-1.amazonaws.com/123/reports' },
            },
        },
    };
}

function activeDirectoryUser(overrides = {}) {
    return new User({
        id: USER_ID,
        login: 'agent',
        nombres: 'Agent',
        apellido1: 'Example',
        apellido2: null,
        email: 'agent@example.com',
        rol_id: '7572f212-bfa6-4026-9d3f-f12de9f5959b',
        is_active: StatusEnum.ACTIVE.value,
        account_type: AccountTypeEnum.ACTIVE_DIRECTORY.value,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        created_by: USER_ID,
        ...overrides,
    });
}

describe('Workspace endpoint lifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    afterEach(() => jest.restoreAllMocks());

    it.each([
        [AvailableController, 'GET'],
        [RegisterChannelHubTagsController, 'POST'],
        [DeactivateController, 'POST'],
    ])('%p uses standard run to rotate the AD cookie and close connections', async (ControllerClass, httpMethod) => {
        const user = activeDirectoryUser({
            session_key: 'existing-session-key',
            session_key_rotated_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
        });
        jest.spyOn(user, 'hasPermission').mockReturnValue(true);
        const controller = new ControllerClass(
            { ...eventFor(), httpMethod },
            { client: 'pg', schema: TENANT_SCHEMA },
            async () => ({ execute: async () => true })
        );
        jest.spyOn(controller, 'getLoggedInUser').mockResolvedValue(user);
        jest.spyOn(controller.repository, 'searchAvailableForActiveGroup').mockResolvedValue([]);
        jest.spyOn(controller, 'createWorkflowExecutor').mockReturnValue({});
        jest.spyOn(WorkspaceChannelHubTagRegistrar.prototype, 'execute').mockResolvedValue({});
        const statements = [];
        jest.spyOn(controller.database_connection.client, 'runner').mockImplementation((builder) => ({
            run: async () => {
                statements.push(builder.toSQL().sql);
                return 1;
            },
        }));
        const cleanup = jest.spyOn(controller, 'destroyDbConnection');
        const repositoryCleanup = jest.spyOn(controller.repository, 'destroyConnection');

        expect(controller.run).toBe(BaseController.prototype.run);
        const response = (await controller.run()).toJson();
        expect(response.statusCode).toBe(200);
        expect(response.headers['Set-Cookie']).toContain('session_key=');
        expect(statements).toEqual([expect.stringContaining('update "tenant_schema"."usuarios"')]);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(repositoryCleanup).toHaveBeenCalledTimes(1);
        expect(controller.database_connection.client.pool).toBeUndefined();
    });

    it.each([
        [{ is_active: false }, 'POST /workspaces/:id/deactivate'],
        [{ is_active: 'false' }, 'POST /workspaces/:id/deactivate'],
        [{ description: '' }, undefined],
    ])('keeps validation guidance specific to legacy deactivation: %p', async (payload, endpoint) => {
        const controller = new Controller(
            { ...eventFor('/{id}'), httpMethod: 'POST', body: JSON.stringify(payload) },
            { client: 'pg', schema: TENANT_SCHEMA }
        );
        const user = activeDirectoryUser();
        jest.spyOn(user, 'hasPermission').mockReturnValue(true);
        jest.spyOn(controller, 'getLoggedInUser').mockResolvedValue(user);
        const response = (await controller.run()).toJson();
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body).data.deactivationEndpoint).toBe(endpoint);
    });
    it.each(['{', 'null', '[]', 'false'])(
        'rejects invalid deactivation body %s before creating the application',
        async (body) => {
            const applicationFactory = jest.fn();
            const controller = new DeactivateController(
                { ...eventFor(), httpMethod: 'POST', body },
                { client: 'pg', schema: TENANT_SCHEMA },
                applicationFactory
            );
            const user = activeDirectoryUser();
            jest.spyOn(user, 'hasPermission').mockReturnValue(true);
            jest.spyOn(controller, 'getLoggedInUser').mockResolvedValue(user);
            const cleanup = jest.spyOn(controller, 'destroyDbConnection');
            const response = (await controller.run()).toJson();
            expect(response.statusCode).toBe(400);
            expect(applicationFactory).not.toHaveBeenCalled();
            expect(cleanup).toHaveBeenCalledTimes(1);
        }
    );

    it('returns 404 for a missing workspace without remote cleanup', async () => {
        const controller = new DeactivateController(
            { ...eventFor(), httpMethod: 'POST' },
            { client: 'pg', schema: TENANT_SCHEMA }
        );
        const user = activeDirectoryUser();
        jest.spyOn(user, 'hasPermission').mockReturnValue(true);
        jest.spyOn(controller, 'getLoggedInUser').mockResolvedValue(user);
        jest.spyOn(controller.repository, 'find').mockResolvedValue(null);
        const workflow = jest.spyOn(controller, 'createWorkflowExecutor');
        const response = (await controller.run()).toJson();
        expect(response.statusCode).toBe(404);
        expect(workflow).not.toHaveBeenCalled();
    });
    it('passes accompanying edits and audit metadata to deactivation', async () => {
        const execute = jest.fn().mockResolvedValue(true);
        const controller = new DeactivateController(
            { ...eventFor(), httpMethod: 'POST', body: JSON.stringify({ description: 'Edited' }) },
            { client: 'pg', schema: TENANT_SCHEMA },
            async () => ({ execute })
        );
        const user = activeDirectoryUser();
        jest.spyOn(user, 'hasPermission').mockReturnValue(true);
        jest.spyOn(controller, 'getLoggedInUser').mockResolvedValue(user);
        expect((await controller.run()).statusCode).toBe(200);
        expect(execute).toHaveBeenCalledWith(
            controller.pathParameters().id,
            expect.objectContaining({
                description: 'Edited',
                is_active: false,
                updated_by: USER_ID,
                updated_at: expect.any(Date),
            })
        );
    });

    it('rejects reactivation through the deactivation endpoint', async () => {
        const applicationFactory = jest.fn();
        const controller = new DeactivateController(
            { ...eventFor(), httpMethod: 'POST', body: JSON.stringify({ is_active: true }) },
            { client: 'pg', schema: TENANT_SCHEMA },
            applicationFactory
        );
        const user = activeDirectoryUser();
        jest.spyOn(user, 'hasPermission').mockReturnValue(true);
        jest.spyOn(controller, 'getLoggedInUser').mockResolvedValue(user);
        expect((await controller.run()).statusCode).toBe(400);
        expect(applicationFactory).not.toHaveBeenCalled();
    });
});
