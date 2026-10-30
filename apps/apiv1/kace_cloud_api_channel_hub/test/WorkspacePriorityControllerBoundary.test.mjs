import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE, GENERAL_INTERNAL_ERROR } from '@kace/error-codes';
import {
    createWorkspacePriorityApplicationArguments,
    WorkspacePriorityControllerBoundary,
} from '../src/WorkspacePriorityControllerBoundary.mjs';

const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const OPERATION_ID = '66666666-6666-4666-8666-666666666666';
const WORKSPACE_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

class WorkspacePriorityApplicationFake {
    lists = [];
    reorderRequests = [];
    operationLookups = [];
    priorities = { items: [{ workspaceId: WORKSPACE_ID, priority: 1 }], revision: 'revision-1' };
    receipt = { operationId: OPERATION_ID, status: 'pending' };
    operation = { operationId: OPERATION_ID, status: 'completed', result: { revision: 'revision-2' } };
    listFailure = null;
    operationFailure = null;
    destroyCalls = 0;

    async list(accountId) {
        this.lists.push(accountId);
        if (this.listFailure) throw this.listFailure;
        return this.priorities;
    }

    async requestReorder(accountId, command, actor) {
        this.reorderRequests.push({ accountId, command, actor });
        return this.receipt;
    }

    async findOperation(accountId, operationId) {
        this.operationLookups.push({ accountId, operationId });
        if (this.operationFailure) throw this.operationFailure;
        return this.operation;
    }

    async destroy() {
        this.destroyCalls += 1;
    }
}

class LoggerFake {
    errors = [];

    logError(...args) {
        this.errors.push(args);
    }
}

const eventFixture = (httpMethod, body) => ({
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { origin: 'https://admin.appsmx.net' },
    httpMethod,
    resource: '/{id}/workspace-priorities',
    kContext: { awsRequestId: 'controller-boundary-contract' },
    tenantContext: {
        tenant: {
            apps_allowed_origins: { value: 'https://admin.appsmx.net' },
            apps_debug: { value: 'true' },
        },
    },
});

const responseJson = (response) => {
    const json = response.toJson();
    return { ...json, body: JSON.parse(json.body) };
};

const createBoundary = ({ method = 'GET', body, application = new WorkspacePriorityApplicationFake() } = {}) => {
    const event = eventFixture(method, body);
    const permissionChecks = [];
    const user = {
        id: { value: USER_ID },
        hasPermission: (...permission) => {
            permissionChecks.push(permission);
            return true;
        },
    };
    const databaseConnection = { name: 'tenant-connection' };
    const writerConfig = { client: 'pg', connection: { host: 'writer' }, schema: 'tenant' };
    const readerConfig = { client: 'pg', connection: { host: 'reader' }, schema: 'tenant' };
    const workflowExecutor = { name: 'workflow-executor' };
    const eventBus = { name: 'event-bus' };
    const factoryCalls = [];
    const workflowExecutorUsers = [];
    const logger = new LoggerFake();
    const boundary = new WorkspacePriorityControllerBoundary({
        event,
        pathParameters: () => ({ id: ACCOUNT_ID, operationId: OPERATION_ID }),
        payload: () => JSON.parse(event.body ?? '{}'),
        tenant: () => ({ id: { value: TENANT_ID } }),
        applicationFactory: async (args) => {
            factoryCalls.push(args);
            return application;
        },
        applicationFactoryArguments: createWorkspacePriorityApplicationArguments({
            databaseConnection,
            writerConfig,
            readerConfig,
            createWorkflowExecutor: (authenticatedUser) => {
                workflowExecutorUsers.push(authenticatedUser);
                return workflowExecutor;
            },
            eventBus,
        }),
        logger,
    });
    return {
        boundary,
        application,
        databaseConnection,
        eventBus,
        factoryCalls,
        logger,
        permissionChecks,
        user,
        workflowExecutor,
        workflowExecutorUsers,
        writerConfig,
        readerConfig,
    };
};

describe('WorkspacePriorityControllerBoundary', () => {
    const originalDebug = process.env.APPS_DEBUG;

    beforeEach(() => {
        process.env.APPS_DEBUG = 'false';
    });

    afterEach(() => {
        if (originalDebug === undefined) delete process.env.APPS_DEBUG;
        else process.env.APPS_DEBUG = originalDebug;
    });

    it('maps GET priorities and supplies the production composition arguments', async () => {
        const context = createBoundary();

        const response = responseJson(await context.boundary.list(context.user));

        expect(response.statusCode).toBe(200);
        expect(response.body.data).toEqual(context.application.priorities);
        expect(context.application.lists).toEqual([ACCOUNT_ID]);
        expect(context.permissionChecks).toEqual([['administrador', 'channel-hub', 'ChannelHubRead']]);
        expect(context.workflowExecutorUsers).toEqual([context.user]);
        expect(context.application.destroyCalls).toBe(1);
        expect(context.factoryCalls).toEqual([
            {
                writerConfig: context.writerConfig,
                readerConfig: context.readerConfig,
                workflowExecutor: context.workflowExecutor,
                eventBus: context.eventBus,
            },
        ]);
    });

    it('maps POST reorder to 202 and propagates the authenticated actor', async () => {
        const context = createBoundary({
            method: 'POST',
            body: { revision: 'revision-1', orderedWorkspaceIds: [WORKSPACE_ID] },
        });

        const response = responseJson(await context.boundary.reorder(context.user));

        expect(response.statusCode).toBe(202);
        expect(response.body.data).toEqual(context.application.receipt);
        expect(context.application.reorderRequests).toEqual([
            {
                accountId: ACCOUNT_ID,
                command: { revision: 'revision-1', orderedWorkspaceIds: [WORKSPACE_ID] },
                actor: { tenantId: TENANT_ID, userId: USER_ID },
            },
        ]);
        expect(context.permissionChecks).toEqual([['administrador', 'channel-hub', 'ChannelHubUpdate']]);
        expect(context.application.destroyCalls).toBe(1);
        expect(context.factoryCalls).toEqual([
            {
                writerConfig: context.writerConfig,
                readerConfig: context.readerConfig,
                workflowExecutor: context.workflowExecutor,
                eventBus: context.eventBus,
            },
        ]);
    });

    it('maps a status lookup through the account and operation route parameters', async () => {
        const context = createBoundary();

        const response = responseJson(await context.boundary.status(context.user));

        expect(response.statusCode).toBe(200);
        expect(response.body.data).toEqual(context.application.operation);
        expect(context.application.operationLookups).toEqual([{ accountId: ACCOUNT_ID, operationId: OPERATION_ID }]);
        expect(context.permissionChecks).toEqual([['administrador', 'channel-hub', 'ChannelHubRead']]);
        expect(context.application.destroyCalls).toBe(1);
        expect(context.factoryCalls).toEqual([
            {
                writerConfig: context.writerConfig,
                readerConfig: context.readerConfig,
                workflowExecutor: context.workflowExecutor,
                eventBus: context.eventBus,
            },
        ]);
    });

    it('maps a sensitive application failure without exposing its diagnostics', async () => {
        const application = new WorkspacePriorityApplicationFake();
        application.listFailure = new Error(
            'User arn:aws:sts::714281575970:assumed-role/private is not authorized for private-queue.fifo'
        );
        const context = createBoundary({ application });

        const response = responseJson(await context.boundary.list(context.user));

        expect(response.statusCode).toBe(500);
        expect(response.body.errors).toEqual([
            { code: GENERAL_INTERNAL_ERROR, message: 'An unexpected error occurred. Please contact support.' },
        ]);
        expect(JSON.stringify(response.body)).not.toContain('arn:aws');
        expect(JSON.stringify(response.body)).not.toContain('private-queue.fifo');
        expect(context.logger.errors).toHaveLength(1);
        expect(context.application.destroyCalls).toBe(1);
    });

    it('preserves the sanitized public mapping for status lookup failures', async () => {
        const application = new WorkspacePriorityApplicationFake();
        application.operationFailure = Object.assign(new Error('private upstream response'), {
            statusCode: 502,
            publicErrorCode: CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
        });
        const context = createBoundary({ application });

        const response = responseJson(await context.boundary.status(context.user));

        expect(response.statusCode).toBe(502);
        expect(response.body.data.code).toBe(CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE);
        expect(response.body.errors).toEqual([
            {
                code: CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
                message: 'An unexpected error occurred. Please contact support.',
            },
        ]);
        expect(JSON.stringify(response.body)).not.toContain('private upstream response');
        expect(context.application.destroyCalls).toBe(1);
    });
});
