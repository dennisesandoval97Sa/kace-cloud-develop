import { jest } from '@jest/globals';
import { User } from '@kace/core/src/users/index.js';
import { CustomError } from '@kace/core/src/shared/index.js';

const repositoryDestroyConnection = jest.fn().mockResolvedValue(undefined);
const repositoryInstances = [];
const claimerExecute = jest.fn();
const releaserExecute = jest.fn();

const KnexInteractionRepository = jest.fn().mockImplementation((knexConfig) => {
    const repository = {
        knexConfig,
        destroyConnection: repositoryDestroyConnection,
    };
    repositoryInstances.push(repository);
    return repository;
});

const InteractionReviewClaimer = jest.fn().mockImplementation(() => ({
    execute: claimerExecute,
}));

const InteractionReviewReleaser = jest.fn().mockImplementation(() => ({
    execute: releaserExecute,
}));

jest.unstable_mockModule('@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository', () => ({
    KnexInteractionRepository,
}));

jest.unstable_mockModule('@kace/core/src/interactions/application/review/InteractionReviewClaimer', () => ({
    InteractionReviewClaimer,
}));

jest.unstable_mockModule('@kace/core/src/interactions/application/review/InteractionReviewReleaser', () => ({
    InteractionReviewReleaser,
}));

const { ControllerReview } = await import('../src/ControllerReview.mjs');

const interactionId = '6e5fd2e1-7a85-4fdb-b7a6-4d3f60901111';
const userId = '6e5fd2e1-7a85-4fdb-b7a6-4d3f60902222';

function tenant() {
    return {
        apps_debug: { value: 'true' },
        aws_cognito_user_pool_id: { value: 'us-east-1_localpool' },
        aws_cognito_app_client_id: { value: 'local-client' },
        aws_sqs_region: { value: 'us-east-1' },
        aws_sqs_events_queue_url: { value: 'https://sqs.example/queue.fifo' },
        aws_event_bridge_region: { value: 'us-east-1' },
        aws_event_bridge_event_bus_name: { value: 'local-bus' },
    };
}

function eventFor(resource = '/{id}/review/claim', id = interactionId) {
    const t = tenant();

    return {
        resource: '/',
        originalResource: resource,
        httpMethod: 'POST',
        path: `/interactions/${id}/review`,
        body: '{}',
        headers: {},
        pathParameters: { id },
        tenant: t,
        tenantContext: { tenant: t },
        kContext: { awsRequestId: 'test-request-id' },
    };
}

function knexConfig() {
    const connection = jest.fn();
    connection.client = {
        config: { client: 'pg', schema: 'test' },
        on: jest.fn(),
    };
    return connection;
}

function userWithPermissions(hasPermission = jest.fn(() => true)) {
    const user = Object.create(User.prototype);
    Object.defineProperty(user, 'id', {
        value: { value: userId },
    });
    Object.defineProperty(user, 'grupo_activo', {
        value: { value: '6e5fd2e1-7a85-4fdb-b7a6-4d3f60903333' },
    });
    Object.defineProperty(user, 'hasPermission', {
        value: hasPermission,
    });

    return user;
}

function controllerFor(event = eventFor(), user = userWithPermissions()) {
    const controller = new ControllerReview(event, knexConfig());
    controller.user = user;

    return controller;
}

function responseJson(response) {
    return response.toJson();
}

function responseBody(response) {
    return JSON.parse(response.toJson().body);
}

describe('ControllerReview', () => {
    // These cases assert the service message reaches the client, which the public
    // error contract only allows with debug on (APPS_DEBUG > APPS_DEBUG_OVERRIDE > tenant).
    const originalAppsDebug = process.env.APPS_DEBUG;

    beforeAll(() => {
        process.env.APPS_DEBUG = 'true';
    });

    afterAll(() => {
        if (originalAppsDebug === undefined) {
            delete process.env.APPS_DEBUG;
        } else {
            process.env.APPS_DEBUG = originalAppsDebug;
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        repositoryInstances.length = 0;
        claimerExecute.mockResolvedValue({
            data: {
                id: interactionId,
                in_review: true,
                start_review_by: userId,
            },
        });
        releaserExecute.mockResolvedValue({
            data: {
                id: interactionId,
                in_review: false,
                start_review_by: null,
            },
        });
    });

    it('calls the review claimer for claim resources and returns HTTP 200 with data', async () => {
        const controller = controllerFor(eventFor('/{id}/review/claim'));

        const response = await controller.actionCreate();

        expect(InteractionReviewClaimer).toHaveBeenCalledWith(repositoryInstances[0], controller.user);
        expect(claimerExecute).toHaveBeenCalledWith(interactionId);
        expect(InteractionReviewReleaser).not.toHaveBeenCalled();
        expect(responseJson(response).statusCode).toBe(200);
        expect(responseBody(response).data).toEqual(
            expect.objectContaining({
                id: interactionId,
                in_review: true,
                start_review_by: userId,
            })
        );
    });

    it('calls the review releaser for release resources and returns HTTP 200 with data', async () => {
        const controller = controllerFor(eventFor('/{id}/review/release'));

        const response = await controller.actionCreate();

        expect(InteractionReviewReleaser).toHaveBeenCalledWith(repositoryInstances[0], controller.user);
        expect(releaserExecute).toHaveBeenCalledWith(interactionId);
        expect(InteractionReviewClaimer).not.toHaveBeenCalled();
        expect(responseJson(response).statusCode).toBe(200);
        expect(responseBody(response).data).toEqual(
            expect.objectContaining({
                id: interactionId,
                in_review: false,
                start_review_by: null,
            })
        );
    });

    it('passes server-derived scope only on the Agent review route', async () => {
        const controller = controllerFor(eventFor('/agent/{id}/review/claim'));

        await controller.actionCreate();

        expect(claimerExecute).toHaveBeenCalledWith(interactionId, {
            userId,
            activeGroupId: '6e5fd2e1-7a85-4fdb-b7a6-4d3f60903333',
        });
    });

    it('returns HTTP 400 for invalid ids before calling a review service', async () => {
        const controller = controllerFor(eventFor('/{id}/review/claim', 'not-a-uuid'));

        const response = await controller.actionCreate();

        expect(responseJson(response).statusCode).toBe(400);
        expect(InteractionReviewClaimer).not.toHaveBeenCalled();
        expect(InteractionReviewReleaser).not.toHaveBeenCalled();
    });

    it('returns HTTP 403 before calling a review service when the user lacks review permissions', async () => {
        const user = userWithPermissions(jest.fn(() => false));
        const controller = controllerFor(eventFor('/{id}/review/claim'), user);

        const response = await controller.actionCreate();

        expect(responseJson(response).statusCode).toBe(403);
        expect(InteractionReviewClaimer).not.toHaveBeenCalled();
        expect(InteractionReviewReleaser).not.toHaveBeenCalled();
    });

    it('calls the review releaser for release resources when the user lacks claim permissions', async () => {
        const user = userWithPermissions(jest.fn(() => false));
        const controller = controllerFor(eventFor('/{id}/review/release'), user);

        const response = await controller.actionCreate();

        expect(InteractionReviewReleaser).toHaveBeenCalledWith(repositoryInstances[0], controller.user);
        expect(releaserExecute).toHaveBeenCalledWith(interactionId);
        expect(InteractionReviewClaimer).not.toHaveBeenCalled();
        expect(responseJson(response).statusCode).toBe(200);
        expect(responseBody(response).data).toEqual(
            expect.objectContaining({
                id: interactionId,
                in_review: false,
                start_review_by: null,
            })
        );
    });

    it('returns HTTP 403 when permission checks throw missing-role errors', async () => {
        const user = userWithPermissions(
            jest.fn((role) => {
                throw new Error(`Missing role: ${role}`);
            })
        );
        const controller = controllerFor(eventFor('/{id}/review/claim'), user);

        const response = await controller.actionCreate();

        expect(responseJson(response).statusCode).toBe(403);
        expect(responseBody(response).message).toBe('You do not have permission to manage interaction review.');
        expect(InteractionReviewClaimer).not.toHaveBeenCalled();
        expect(InteractionReviewReleaser).not.toHaveBeenCalled();
    });

    it('maps review service bad request errors to HTTP 400 with the service message', async () => {
        claimerExecute.mockRejectedValueOnce(new CustomError('Closed interactions cannot be claimed for review', 400));
        const controller = controllerFor(eventFor('/{id}/review/claim'));

        const response = await controller.actionCreate();

        expect(claimerExecute).toHaveBeenCalledWith(interactionId);
        expect(responseJson(response).statusCode).toBe(400);
        expect(responseBody(response).message).toBe('Closed interactions cannot be claimed for review');
    });

    it('maps review service conflict errors to HTTP 409 with the service message', async () => {
        claimerExecute.mockRejectedValueOnce(new CustomError('Interaction is already in review by another user', 409));
        const controller = controllerFor(eventFor('/{id}/review/claim'));

        const response = await controller.actionCreate();

        expect(claimerExecute).toHaveBeenCalledWith(interactionId);
        expect(responseJson(response).statusCode).toBe(409);
        expect(responseBody(response).message).toBe('Interaction is already in review by another user');
    });
});
