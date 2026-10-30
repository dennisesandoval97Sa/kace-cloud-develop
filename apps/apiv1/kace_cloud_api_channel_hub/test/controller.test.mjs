import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Helper } from '@kace/core/src/shared/index.js';
import { User } from '@kace/core/src/users/index.js';
import { KnexRepository } from '@kace/core/src/shared/infrastructure/persistence/KnexRepository.js';
import { ChannelHubAccountRegistrar } from '@kace/core/src/channel-hub-accounts/application/register/ChannelHubAccountRegistrar.js';
import { Controller } from '../src/controller.mjs';
import { ChannelHubWorkflowExecutorFactory } from '../src/createChannelHubWorkflowExecutor.mjs';
import {
    ChannelHubAccountAuthorizationError,
    ChannelHubAccountPaginationError,
    ChannelHubAccountValidationError,
} from '../src/ChannelHubAccountActionsApplication.mjs';

const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WORKSPACE_ID = '55555555-5555-4555-8555-555555555555';
const OPERATION_ID = '66666666-6666-4666-8666-666666666666';
const USER = {
    id: USER_ID,
    rol_id: ACCOUNT_ID,
    is_active: 1,
    created_at: '2026-09-07T00:00:00Z',
    created_by: USER_ID,
    updated_at: '2026-09-07T00:00:00Z',
    updated_by: USER_ID,
};
const workflowConstructor = jest.fn();
const controllers = [];
const executors = [];
const createWorkflowExecutor = ChannelHubWorkflowExecutorFactory.prototype.create;

class WorkflowExecutorFake {
    constructor(...args) {
        workflowConstructor(...args);
    }
}

const responseJson = (response) => {
    const json = response.toJson();
    return { statusCode: json.statusCode, body: JSON.parse(json.body) };
};

const createController = ({ body = { limit: 10, offset: 0 }, queryStringParameters, reader = true } = {}) => {
    const writerConfig = { client: 'pg', connection: { host: 'writer.invalid' }, pool: { min: 0, max: 1 } };
    const readerConfig = reader ? { ...writerConfig, connection: { host: 'reader.invalid' } } : null;
    const event = {
        body: JSON.stringify(body),
        headers: { origin: 'https://admin.appsmx.net' },
        httpMethod: 'POST',
        resource: '/',
        pathParameters: { id: ACCOUNT_ID, operationId: OPERATION_ID },
        queryStringParameters,
        kContext: { awsRequestId: 'controller-contract' },
        tenantContext: {
            readerConfig,
            tenant: {
                id: { value: TENANT_ID },
                aws_cognito_user_pool_id: { value: 'us-east-1_contract' },
                aws_cognito_app_client_id: { value: 'contract-client' },
                apps_allowed_origins: { value: 'https://admin.appsmx.net' },
            },
        },
    };
    const data = { items: [{ id: ACCOUNT_ID, name: 'Support' }] };
    const application = {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        register: jest.fn(),
        find: jest.fn().mockResolvedValue({ toJson: () => ({ data }) }),
        index: jest.fn().mockResolvedValue({ toJson: () => ({ data }) }),
        search: jest.fn().mockResolvedValue({ toJson: () => ({ data }) }),
        list: jest.fn().mockResolvedValue({ items: [], revision: 'revision-1' }),
        requestReorder: jest.fn().mockResolvedValue({ operationId: OPERATION_ID, status: 'pending' }),
        findOperation: jest.fn().mockResolvedValue({ operationId: OPERATION_ID, status: 'completed' }),
        destroy: jest.fn(),
    };
    const applicationFactory = jest.fn(async ({ workflowExecutor }) => {
        application.destroy.mockImplementation(() => workflowExecutor.destroy());
        return application;
    });
    const controller = new Controller(event, writerConfig, applicationFactory, applicationFactory);
    controllers.push(controller);
    controller.user = new User(USER);
    jest.spyOn(controller.user, 'hasPermission').mockReturnValue(true);
    jest.spyOn(controller.user, 'hasSearchPermission').mockReturnValue(true);
    return { controller, event, application, applicationFactory, data, writerConfig, readerConfig };
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(process, 'env', { ...process.env, APPS_DEBUG: 'false' });
    jest.spyOn(Helper, 'logInfo').mockImplementation(() => {});
    jest.spyOn(Helper, 'logError').mockImplementation(() => {});
    jest.spyOn(Helper, 'logDebug').mockImplementation(() => {});
    const factory = new ChannelHubWorkflowExecutorFactory({ WorkflowExecutorClass: WorkflowExecutorFake });
    jest.spyOn(ChannelHubWorkflowExecutorFactory.prototype, 'create').mockImplementation(async (args) => {
        const executor = await createWorkflowExecutor.call(factory, args);
        jest.spyOn(executor, 'destroy');
        executors.push(executor);
        return executor;
    });
});

afterEach(async () => {
    await Promise.all(controllers.splice(0).map((controller) => controller.destroyDbConnection()));
    await Promise.all(executors.splice(0).map((executor) => executor.destroy()));
    jest.restoreAllMocks();
});

describe('Channel Hub Controller', () => {
    it.each([
        ['actionCreate', 'create', 201],
        ['actionUpdate', 'update', 200],
        ['actionDelete', 'delete', 200],
        ['actionRead', 'find', 200],
        ['actionIndex', 'index', 200],
        ['actionSearch', 'search', 200],
        ['actionRegister', 'register', 200],
    ])('%s dispatches the authenticated request and releases its application', async (action, operation, status) => {
        const context = createController({ queryStringParameters: { limit: '5', offset: '2' } });
        const { controller, application, event } = context;
        const expectedArguments = {
            create: [JSON.parse(event.body), controller.user],
            update: [ACCOUNT_ID, JSON.parse(event.body), controller.user],
            delete: [ACCOUNT_ID, controller.user],
            find: [ACCOUNT_ID, controller.user],
            index: [event.queryStringParameters, controller.user],
            search: [JSON.parse(event.body), controller.user],
            register: [ACCOUNT_ID, controller.user],
        };

        const response = responseJson(await controller[action]());

        expect(response.statusCode).toBe(status);
        expect(application[operation]).toHaveBeenCalledWith(...expectedArguments[operation]);
        expect(application.destroy).toHaveBeenCalledTimes(1);
        expect(executors[0].destroy).toHaveBeenCalledTimes(1);
        expect(context.applicationFactory).toHaveBeenCalledWith({
            repository: controller.repository,
            registrationFlowValidator: controller.registrationFlowValidator,
            workflowExecutor: executors[0],
            createdAt: controller.started_at,
        });
        if (['find', 'index', 'search'].includes(operation)) expect(response.body.data).toEqual(context.data);
    });

    it.each([
        ['actionCreate', 'create'],
        ['actionUpdate', 'update'],
        ['actionDelete', 'delete'],
        ['actionRead', 'find'],
        ['actionIndex', 'index'],
        ['actionSearch', 'search'],
        ['actionRegister', 'register'],
    ])('%s maps permission and unexpected failures and still destroys the application', async (action, operation) => {
        const { controller, application } = createController();
        application[operation].mockRejectedValueOnce(new ChannelHubAccountAuthorizationError('Access denied'));
        expect(responseJson(await controller[action]()).statusCode).toBe(403);
        expect(application.destroy).toHaveBeenCalledTimes(1);

        application[operation].mockRejectedValueOnce(new Error('private upstream credentials'));
        const response = responseJson(await controller[action]());
        expect(response.statusCode).toBe(500);
        expect(JSON.stringify(response.body)).not.toContain('private upstream credentials');
        expect(application.destroy).toHaveBeenCalledTimes(2);
        expect(executors.map((executor) => executor.destroy.mock.calls.length)).toEqual([1, 1]);
    });

    it('maps payload validation and pagination errors to 400', async () => {
        const { controller, application } = createController();
        application.create.mockRejectedValue(new ChannelHubAccountValidationError({ message: 'Invalid name' }));
        application.index.mockRejectedValue(new ChannelHubAccountPaginationError());

        expect(responseJson(await controller.actionCreate()).statusCode).toBe(400);
        expect(responseJson(await controller.actionIndex()).statusCode).toBe(400);
        expect(application.destroy).toHaveBeenCalledTimes(2);
    });

    it('defaults an absent index query and reader configuration', async () => {
        const { controller, application } = createController({ reader: false });

        expect(responseJson(await controller.actionIndex()).statusCode).toBe(200);
        expect(application.index).toHaveBeenCalledWith({}, controller.user);
        expect(ChannelHubWorkflowExecutorFactory.prototype.create).toHaveBeenCalledWith({
            writerConfig: controller.writerConfig,
            readerConfig: null,
            authenticatedUser: controller.user,
        });
    });

    it('destroys the workflow pools when account application construction fails', async () => {
        const { controller, applicationFactory, application } = createController();
        applicationFactory.mockRejectedValue(new Error('construction failed'));
        const destroyConnection = jest.spyOn(KnexRepository.prototype, 'destroyConnection');

        expect(responseJson(await controller.actionCreate()).statusCode).toBe(500);
        expect(application.create).not.toHaveBeenCalled();
        expect(executors[0].destroy).toHaveBeenCalledTimes(1);
        expect(destroyConnection).toHaveBeenCalledTimes(3);
    });

    it('composes the default account application and enforces its permission check', async () => {
        const { event, writerConfig } = createController();
        const controller = new Controller(event, writerConfig);
        controllers.push(controller);
        controller.user = new User(USER);
        const permission = jest.spyOn(controller.user, 'hasPermission').mockReturnValue(false);
        const applicationFactory = jest.spyOn(controller, 'accountActionsApplicationFactory');

        const response = responseJson(await controller.actionCreate());
        expect(response.statusCode).toBe(403);
        const application = await applicationFactory.mock.results[0].value;
        expect(application.registrar).toBeInstanceOf(ChannelHubAccountRegistrar);
        expect(permission).toHaveBeenCalledWith('administrador', 'channel-hub', 'ChannelHubCreate');
        expect(executors[0].destroy).toHaveBeenCalledTimes(1);
    });

    it('rejects search permission, malformed queries, and unauthorized advanced queries before composition', async () => {
        const { controller, applicationFactory } = createController();
        controller.user.hasPermission.mockReturnValue(false);
        expect(responseJson(await controller.actionSearch()).statusCode).toBe(403);
        controller.user.hasPermission.mockReturnValue(true);
        controller.event.body = JSON.stringify({ limit: 'invalid', offset: 0 });
        expect(responseJson(await controller.actionSearch()).statusCode).toBe(400);
        controller.event.body = JSON.stringify({ limit: 10, offset: 0, select: ['private_column'] });
        controller.user.hasSearchPermission.mockReturnValue(false);
        expect(responseJson(await controller.actionSearch()).statusCode).toBe(403);
        expect(applicationFactory).not.toHaveBeenCalled();
    });

    it('composes priority listing with tenant pools, authenticated user, event bus, and a bounded HTTP timeout', async () => {
        const { controller, application, applicationFactory, writerConfig, readerConfig } = createController();
        const destroyConnection = jest.spyOn(KnexRepository.prototype, 'destroyConnection');

        const response = responseJson(await controller.actionWorkspacePriorityList());

        expect(response.statusCode).toBe(200);
        expect(response.body.data).toEqual({ items: [], revision: 'revision-1' });
        expect(application.list).toHaveBeenCalledWith(ACCOUNT_ID);
        expect(controller.user.hasPermission).toHaveBeenCalledWith('administrador', 'channel-hub', 'ChannelHubRead');
        expect(applicationFactory).toHaveBeenCalledWith({
            writerConfig,
            readerConfig,
            workflowExecutor: executors[0],
            eventBus: controller.eventPublisher,
        });
        expect(workflowConstructor).toHaveBeenCalledWith(
            expect.any(KnexRepository),
            expect.any(KnexRepository),
            expect.any(KnexRepository),
            controller.user,
            { requestTimeoutMs: 10_000 }
        );
        for (const repository of workflowConstructor.mock.calls[0].slice(0, 3)) {
            expect(repository.writer.client.config.connection.host).toBe('writer.invalid');
            expect(repository.reader.client.config.connection.host).toBe('reader.invalid');
            expect(repository.writer.client.config.pool).toMatchObject({ min: 0, max: 1 });
            expect(repository.reader.client.config.pool).toMatchObject({ min: 0, max: 1 });
        }
        expect(application.destroy).toHaveBeenCalledTimes(1);
        expect(destroyConnection).toHaveBeenCalledTimes(3);
    });

    it('passes the reorder command and authenticated tenant actor, then resolves its receipt', async () => {
        const command = { revision: 'revision-1', orderedWorkspaceIds: [WORKSPACE_ID] };
        const { controller, application } = createController({ body: command });

        const accepted = responseJson(await controller.actionWorkspacePriorityReorder());
        expect(accepted.statusCode).toBe(202);
        expect(accepted.body.data).toEqual({ operationId: OPERATION_ID, status: 'pending' });
        expect(application.requestReorder).toHaveBeenCalledWith(ACCOUNT_ID, command, {
            tenantId: TENANT_ID,
            userId: USER_ID,
        });
        expect(controller.user.hasPermission).toHaveBeenCalledWith('administrador', 'channel-hub', 'ChannelHubUpdate');

        const completed = responseJson(await controller.actionWorkspacePriorityReorderStatus());
        expect(completed.statusCode).toBe(200);
        expect(completed.body.data).toEqual({ operationId: OPERATION_ID, status: 'completed' });
        expect(application.findOperation).toHaveBeenCalledWith(ACCOUNT_ID, OPERATION_ID);
        expect(application.destroy).toHaveBeenCalledTimes(2);
    });
});
