import { jest } from '@jest/globals';
import { CustomError, ValidationFailError } from '@kace/core/src/shared/index.js';
import { User } from '@kace/core/src/users/index.js';
import { BulkCloseController } from '../src/BulkCloseController.mjs';
import { BulkDeleteController } from '../src/BulkDeleteController.mjs';
import { BulkMoveController } from '../src/BulkMoveController.mjs';
import { AgentMoveDestinationsController } from '../src/AgentMoveDestinationsController.mjs';

const interactionId = '11111111-1111-4111-8111-111111111111';
const workspaceId = '22222222-2222-4222-8222-222222222222';

function tenant() {
    return {
        apps_debug: { value: 'true' },
        apps_allowed_origins: { value: '*' },
        aws_cognito_user_pool_id: { value: 'us-east-1_localpool' },
        aws_cognito_app_client_id: { value: 'local-client' },
        aws_sqs_region: { value: 'us-east-1' },
        aws_sqs_events_queue_url: { value: 'https://sqs.example/queue.fifo' },
        aws_event_bridge_region: { value: 'us-east-1' },
        aws_event_bridge_event_bus_name: { value: 'local-bus' },
    };
}

function eventFor(payload, originalResource = null) {
    const t = tenant();

    return {
        resource: '/',
        ...(originalResource ? { originalResource } : {}),
        httpMethod: 'POST',
        path: '/interactions-bulk',
        body: JSON.stringify(payload),
        headers: {},
        tenant: t,
        tenantContext: { tenant: t },
        kContext: { awsRequestId: 'test-request-id' },
    };
}

function destinationEvent() {
    const event = eventFor({}, '/agent/{id}/move-destinations');
    return { ...event, httpMethod: 'GET', pathParameters: { id: interactionId } };
}

function knexConfig() {
    const connection = jest.fn();
    connection.client = {
        config: { client: 'pg', schema: 'test' },
        on: jest.fn(),
    };
    return connection;
}

function userWithPermission(granted = true) {
    const user = Object.create(User.prototype);
    Object.defineProperty(user, 'id', {
        value: { value: 'authorized-user-id' },
    });
    Object.defineProperty(user, 'grupo_activo', {
        value: { value: 'active-group-id' },
    });
    Object.defineProperty(user, 'hasPermission', {
        value: jest.fn(() => granted),
    });

    return user;
}

function responsePayload(response) {
    return JSON.parse(response.toJson().body);
}

function controllerFor(
    ControllerClass,
    payload,
    { result = { updated: 2 }, error, granted = true, originalResource = null } = {}
) {
    const execute = jest.fn();
    if (error) {
        execute.mockRejectedValue(error);
    } else {
        execute.mockResolvedValue(result);
    }

    const controller = new ControllerClass(eventFor(payload, originalResource), knexConfig(), {
        useCaseFactory: () => ({ execute }),
    });
    controller.user = userWithPermission(granted);

    return { controller, execute };
}

describe('interactions bulk controllers', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('moves interactions and returns the updated count', async () => {
        const payload = {
            interaction_ids: [interactionId],
            workspace_id: workspaceId,
        };
        const { controller, execute } = controllerFor(BulkMoveController, payload, { result: { updated: 1 } });

        const response = await controller.actionCreate();

        expect(execute).toHaveBeenCalledWith(payload);
        expect(response.toJson().statusCode).toBe(200);
        expect(responsePayload(response).data).toEqual({ updated: 1 });
        expect(controller.user.hasPermission).toHaveBeenCalledWith(
            'administrador',
            'interactions',
            'InteractionsBulkMove'
        );
    });

    it('closes interactions and returns the updated count', async () => {
        const payload = {
            interaction_ids: [interactionId],
            motive: 'resolved',
        };
        const { controller, execute } = controllerFor(BulkCloseController, payload, { result: { updated: 1 } });

        const response = await controller.actionCreate();

        expect(execute).toHaveBeenCalledWith(payload);
        expect(response.toJson().statusCode).toBe(200);
        expect(responsePayload(response).data).toEqual({ updated: 1 });
        expect(controller.user.hasPermission).toHaveBeenCalledWith(
            'administrador',
            'interactions',
            'InteractionsBulkClose'
        );
    });

    it('scopes Agent close and retains the existing bulk-close permission', async () => {
        const payload = { interaction_ids: [interactionId], motive: 'resolved' };
        const { controller, execute } = controllerFor(BulkCloseController, payload, {
            result: { updated: 1 },
            originalResource: '/agent/close',
        });

        await controller.actionCreate();

        expect(controller.user.hasPermission).toHaveBeenCalledWith(
            'administrador',
            'interactions',
            'InteractionsBulkClose'
        );
        expect(execute).toHaveBeenCalledWith(payload, {
            userId: 'authorized-user-id',
            activeGroupId: 'active-group-id',
        });
    });

    it('uses update permission and server-derived scope for Agent move', async () => {
        const payload = { interaction_ids: [interactionId], workspace_id: workspaceId };
        const { controller, execute } = controllerFor(BulkMoveController, payload, {
            result: { updated: 1 },
            originalResource: '/agent/move',
        });

        await controller.actionCreate();

        expect(controller.user.hasPermission).toHaveBeenCalledWith(
            'administrador',
            'interactions',
            'InteractionsUpdate'
        );
        expect(execute).toHaveBeenCalledWith(payload, {
            userId: 'authorized-user-id',
            activeGroupId: 'active-group-id',
        });
    });

    it('authorizes source-bound Agent move destination discovery', async () => {
        const execute = jest.fn().mockResolvedValue([{ id: workspaceId, description: 'Destination' }]);
        const controller = new AgentMoveDestinationsController(destinationEvent(), knexConfig(), {
            useCaseFactory: () => ({ execute }),
        });
        controller.user = userWithPermission();

        const response = await controller.actionIndex();

        expect(controller.user.hasPermission).toHaveBeenCalledWith(
            'administrador',
            'interactions',
            'InteractionsUpdate'
        );
        expect(execute).toHaveBeenCalledWith(interactionId, {
            userId: 'authorized-user-id',
            activeGroupId: 'active-group-id',
        });
        expect(responsePayload(response).data).toEqual([{ id: workspaceId, description: 'Destination' }]);
    });

    it('returns a generic 404 for inaccessible destination discovery sources', async () => {
        const execute = jest.fn().mockRejectedValue(new CustomError('Interaction not found', 404));
        const controller = new AgentMoveDestinationsController(destinationEvent(), knexConfig(), {
            useCaseFactory: () => ({ execute }),
        });
        controller.user = userWithPermission();

        const response = await controller.actionIndex();

        expect(response.toJson().statusCode).toBe(404);
        expect(responsePayload(response).message).toBe('Interaction not found');
    });

    it('forbids Agent move destination discovery without update permission', async () => {
        const execute = jest.fn();
        const controller = new AgentMoveDestinationsController(destinationEvent(), knexConfig(), {
            useCaseFactory: () => ({ execute }),
        });
        controller.user = userWithPermission(false);

        const response = await controller.actionIndex();

        expect(response.toJson().statusCode).toBe(403);
        expect(execute).not.toHaveBeenCalled();
    });

    it('deletes interactions with the delete permission and returns the updated count', async () => {
        const payload = {
            interaction_ids: [interactionId],
            motive: 'duplicate',
        };
        const { controller, execute } = controllerFor(BulkDeleteController, payload, { result: { updated: 1 } });

        const response = await controller.actionCreate();

        expect(execute).toHaveBeenCalledWith(payload);
        expect(response.toJson().statusCode).toBe(200);
        expect(responsePayload(response).data).toEqual({ updated: 1 });
        expect(controller.user.hasPermission).toHaveBeenCalledWith(
            'administrador',
            'interactions',
            'InteractionsDelete'
        );
    });

    it('rejects invalid payloads before calling the use case', async () => {
        const { controller, execute } = controllerFor(BulkDeleteController, {
            interaction_ids: [interactionId],
            motive: '   ',
        });

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
        expect(execute).not.toHaveBeenCalled();
    });

    it('returns forbidden before calling the use case when permission is missing', async () => {
        const { controller, execute } = controllerFor(
            BulkMoveController,
            {
                interaction_ids: [interactionId],
                workspace_id: workspaceId,
            },
            { granted: false }
        );

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(403);
        expect(execute).not.toHaveBeenCalled();
    });

    it('maps CustomError and ValidationFailError responses', async () => {
        const custom = controllerFor(
            BulkMoveController,
            {
                interaction_ids: [interactionId],
                workspace_id: workspaceId,
            },
            { error: new CustomError('Destination workspace does not exist or is inactive', 404) }
        );
        const validation = controllerFor(
            BulkCloseController,
            {
                interaction_ids: [interactionId],
                motive: 'resolved',
            },
            { error: new ValidationFailError('Invalid motive', 'motive') }
        );

        const customResponse = await custom.controller.actionCreate();
        const validationResponse = await validation.controller.actionCreate();

        expect(customResponse.toJson().statusCode).toBe(404);
        expect(validationResponse.toJson().statusCode).toBe(400);
    });
});
