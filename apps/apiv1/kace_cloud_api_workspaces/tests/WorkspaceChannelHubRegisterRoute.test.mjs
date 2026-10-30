import { jest } from '@jest/globals';

const registrarExecute = jest.fn();
const destroyDbConnection = jest.fn().mockResolvedValue(undefined);
const getLoggedInUser = jest.fn();
const hasPermission = jest.fn();
const logError = jest.fn();
const runController = jest.fn();
const searchAvailableForActiveGroup = jest.fn();
const destroyRepositoryConnection = jest.fn().mockResolvedValue(undefined);
const workflowExecutor = { execute: jest.fn() };

class MockWorkspaceChannelHubTagRegistrarError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'WorkspaceChannelHubTagRegistrarError';
        this.statusCode = statusCode;
    }
}

jest.unstable_mockModule('@kace/api-common', () => ({
    withTenantContext: (handler) => handler,
    Response: class {
        constructor(payload) {
            if (payload.errors instanceof Error) {
                payload.message =
                    payload.event?.tenant?.apps_debug?.value === 'true'
                        ? payload.errors.message
                        : 'An unexpected error occurred. Please contact support';
            }
            this.payload = payload;
        }

        toJson() {
            return {
                statusCode: this.payload.statusCode,
                body: JSON.stringify(this.payload),
            };
        }
    },
    HttpResponse: {
        ok: (payload) => ({ toJson: () => ({ statusCode: 200, body: JSON.stringify(payload) }) }),
        badRequest: (payload) => ({ toJson: () => ({ statusCode: 400, body: JSON.stringify(payload) }) }),
        forbidden: (payload) => ({ toJson: () => ({ statusCode: 403, body: JSON.stringify(payload) }) }),
        notFound: (payload) => ({ toJson: () => ({ statusCode: 404, body: JSON.stringify(payload) }) }),
        validationsFail: (payload) => ({ toJson: () => ({ statusCode: 400, body: JSON.stringify(payload) }) }),
        internalServerError: (payload) => ({ toJson: () => ({ statusCode: 500, body: JSON.stringify(payload) }) }),
    },
    SearchAuthorizationError: class extends Error {},
    SearchAuthorizationService: class {
        authorize(_policy, payload) {
            return payload;
        }
    },
    activeGroupScopeFromAuthenticatedUser: (user) => ({
        userId: user?.id?.value ?? user?.id ?? null,
        activeGroupId: user?.grupo_activo?.value ?? user?.grupo_activo ?? null,
    }),
    BaseController: class {
        constructor(event, knexConfig) {
            this.event = event;
            this.knexConfig = knexConfig;
            this.database_connection = knexConfig;
            this.tenant = {
                id: { value: TENANT_ID },
                apps_execute_rest_hook_service_url: { value: KACE_API_BASE_URL },
            };
        }

        payload() {
            return JSON.parse(this.event.body ?? '{}');
        }

        pathParameters() {
            return this.event.pathParameters ?? {};
        }

        validateId(id) {
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        }

        getLoggedInUser() {
            return getLoggedInUser();
        }

        destroyDbConnection() {
            return destroyDbConnection();
        }

        async run() {
            runController();
            try {
                this.user = await this.getLoggedInUser();
                if (this.event.resource === '/') {
                    return this.event.httpMethod === 'GET' ? await this.actionIndex() : await this.actionCreate();
                }
                if (this.event.resource === '/{id}' && this.event.httpMethod === 'POST')
                    return await this.actionUpdate();
                return { toJson: () => ({ statusCode: 404 }) };
            } finally {
                await this.destroyDbConnection();
            }
        }
    },
}));

jest.unstable_mockModule('@kace/api-common/src/validation/schemas/SearchSchema', () => ({
    SearchSchema: { validate: jest.fn((value) => ({ value })) },
}));

jest.unstable_mockModule('@kace/api-common/src/security/ObjectIdentityAuthorization.js', () => ({
    objectIdentityErrorResponse: jest.fn(() => null),
    secureObjectCreatePayload: jest.fn(async ({ payload }) => payload),
}));

const workspaceRepository = {
    repositoryName: 'workspaces',
    searchAvailableForActiveGroup,
    destroyConnection: destroyRepositoryConnection,
};
jest.unstable_mockModule('@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js', () => ({
    KnexWorkspacesRepository: jest.fn().mockImplementation(() => workspaceRepository),
}));

jest.unstable_mockModule('@kace/core/src/ws-rest-flow-executions/index.js', () => ({
    KnexWSRestFlowExecutionRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule(
    '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js',
    () => ({
        KnexWSRestWorkflowStepRepository: jest.fn().mockImplementation((connection) => ({
            repositoryName: 'ws-rest-workflow-steps',
            connection,
        })),
    })
);

jest.unstable_mockModule(
    '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js',
    () => ({
        KnexAllowedConnectionsRepository: jest.fn().mockImplementation((connection) => ({
            repositoryName: 'allowed-connections',
            connection,
        })),
    })
);

jest.unstable_mockModule(
    '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js',
    () => ({
        KnexSecretsVaultRepository: jest.fn().mockImplementation((connection) => ({
            repositoryName: 'secrets-vault',
            connection,
        })),
    })
);

jest.unstable_mockModule('@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor.js', () => ({
    WorkflowExecutor: jest.fn().mockImplementation(() => workflowExecutor),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn(), logError },
}));

jest.unstable_mockModule('@kace/core/src/workspaces/application/create/WorkspaceCreator.js', () => ({
    WorkspaceCreator: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/delete/WorkspaceDeleter.js', () => ({
    WorkspaceDeleter: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/find/WorkspaceFinder.js', () => ({
    WorkspaceFinder: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/search/WorkspaceSearcher.js', () => ({
    WorkspaceSearcher: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/update/WorkspaceUpdater.js', () => ({
    WorkspaceUpdater: jest.fn(),
}));

jest.unstable_mockModule('../src/WorkspaceTagUpdateFlowQueuer.mjs', () => ({
    WorkspaceTagUpdateFlowQueuer: jest.fn(),
    removedChannelHubRuleTargets: jest.fn(() => []),
    rulesWithoutRemovedLegacyRuleId: jest.fn((rules) => rules),
    workspaceToJson: jest.fn((workspace) => workspace),
}));

jest.unstable_mockModule('../src/WorkspaceChannelHubTagRegistrar.mjs', () => ({
    WorkspaceChannelHubTagRegistrar: jest.fn().mockImplementation(() => ({ execute: registrarExecute })),
    WorkspaceChannelHubTagRegistrarError: MockWorkspaceChannelHubTagRegistrarError,
}));

const { handler } = await import('../src/handler.mjs');
const { WorkspaceChannelHubTagRegistrar } = await import('../src/WorkspaceChannelHubTagRegistrar.mjs');
const { SERVICE_MANIFEST } = await import('../../../../packages/kace_cloud_local_server/src/service-manifest.mjs');

const WORKSPACE_ID = '95346f17-4ee8-420d-a0af-16d2ac394dd9';
const USER_ID = '6bae1fbf-afd4-4bd0-b07e-24ed9dc5a13e';
const GROUP_ID = '778be135-b94b-4529-9b74-075f2bedb5cd';
const TENANT_ID = 'bb829f50-2d99-4cc1-ac0b-44cf935bb099';
const KACE_API_BASE_URL = 'https://correos-api.kace-cloudtest.com/';

function createEvent({
    pathId = WORKSPACE_ID,
    resource = '/{id}/channel-hub-tags/register',
    httpMethod = 'POST',
} = {}) {
    return {
        httpMethod,
        resource,
        pathParameters: { id: pathId },
        body: JSON.stringify({}),
        tenantContext: {
            knexConfig: { client: 'mock' },
            tenant: { apps_debug: { value: 'false' } },
        },
    };
}

describe('Workspace Channel Hub register route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        hasPermission.mockReturnValue(true);
        getLoggedInUser.mockResolvedValue({
            id: { value: USER_ID },
            grupo_activo: { value: GROUP_ID },
            hasPermission,
        });
        registrarExecute.mockResolvedValue({
            workspace_id: WORKSPACE_ID,
            rule_id: '3E5FX4NM9SGdWZzz9Ad0ZNGHskf',
            connection_id: '3E3R0BE70304do9a0Z6a9mqmTCK',
        });
        runController.mockReturnValue({
            toJson: () => ({
                statusCode: 404,
                body: JSON.stringify({ message: 'Resource not found' }),
            }),
        });
    });

    it('routes POST /{id}/channel-hub-tags/register to the register controller method', async () => {
        const response = await handler(createEvent());

        expect(response.statusCode).toBe(200);
        expect(hasPermission).toHaveBeenCalledWith('administrador', 'workspaces', 'WorkspacesUpdate');
        expect(WorkspaceChannelHubTagRegistrar).toHaveBeenCalledWith({
            workspaceRepository,
            workflowExecutor,
            metadata: {
                tenant_id: TENANT_ID,
                user_id: USER_ID,
            },
            currentUser: expect.objectContaining({ id: { value: USER_ID } }),
            kaceApiBaseUrl: KACE_API_BASE_URL,
        });
        expect(registrarExecute).toHaveBeenCalledWith(WORKSPACE_ID);
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
    });

    it('requires WorkspacesUpdate permission', async () => {
        hasPermission.mockReturnValue(false);

        const response = await handler(createEvent());

        expect(response.statusCode).toBe(403);
        expect(registrarExecute).not.toHaveBeenCalled();
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when the path workspace id is invalid', async () => {
        const response = await handler(createEvent({ pathId: 'not-a-uuid' }));

        expect(response.statusCode).toBe(400);
        expect(registrarExecute).not.toHaveBeenCalled();
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
    });

    it('maps registrar 409 conflicts to HTTP 409', async () => {
        const error = new MockWorkspaceChannelHubTagRegistrarError(
            'Workspace already has a Channel Hub rule registered',
            409
        );
        registrarExecute.mockRejectedValue(error);

        const response = await handler(createEvent());
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(409);
        expect(body.message).toBe('Workspace already has a Channel Hub rule registered');
        expect(body.errors).toEqual({
            name: 'WorkspaceChannelHubTagRegistrarError',
            message: 'Workspace already has a Channel Hub rule registered',
        });
        expect(logError).toHaveBeenCalledWith(error);
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
    });

    it('maps registrar 502 integration failures to HTTP 502', async () => {
        const error = new MockWorkspaceChannelHubTagRegistrarError(
            'Create-tag RESTflow response did not include a Channel Hub rule id',
            502
        );
        registrarExecute.mockRejectedValue(error);

        const response = await handler(createEvent());

        expect(response.statusCode).toBe(502);
        expect(logError).toHaveBeenCalledWith(error);
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
    });

    it('bypasses the registrar for the removed rule-created callback route', async () => {
        const response = await handler(
            createEvent({
                resource: '/{id}/channel-hub-tags/rule-created',
            })
        );

        expect(response.statusCode).toBe(404);
        expect(runController).toHaveBeenCalledTimes(1);
        expect(WorkspaceChannelHubTagRegistrar).not.toHaveBeenCalled();
        expect(registrarExecute).not.toHaveBeenCalled();
    });
});

describe('Workspace available route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        hasPermission.mockReturnValue(true);
        getLoggedInUser.mockResolvedValue({
            id: { value: USER_ID },
            grupo_activo: { value: GROUP_ID },
            hasPermission,
        });
        searchAvailableForActiveGroup.mockResolvedValue([
            { toJson: () => ({ id: WORKSPACE_ID, description: 'Scoped workspace' }) },
        ]);
    });

    it('passes the authenticated user and active group to the scoped repository query', async () => {
        const response = await handler(createEvent({ resource: '/available', httpMethod: 'GET' }));
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(200);
        expect(searchAvailableForActiveGroup).toHaveBeenCalledWith({
            userId: USER_ID,
            activeGroupId: GROUP_ID,
        });
        expect(body.data).toEqual([{ id: WORKSPACE_ID, description: 'Scoped workspace' }]);
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
    });
});

describe('Workspace local-server route manifest', () => {
    it('registers the workspace Channel Hub register route and not the removed callback route', () => {
        const workspaceService = SERVICE_MANIFEST.find((service) => service.directory === 'kace_cloud_api_workspaces');

        expect(workspaceService.customRoutes).toContainEqual({
            method: 'POST',
            resource: '/{id}/channel-hub-tags/register',
        });
        expect(workspaceService.customRoutes).not.toContainEqual({
            method: 'POST',
            resource: '/{id}/channel-hub-tags/rule-created',
        });
    });
});

describe('Workspace deactivate route', () => {
    it('requires update permission through run before starting deactivation', async () => {
        jest.clearAllMocks();
        hasPermission.mockReturnValue(false);
        getLoggedInUser.mockResolvedValue({ id: { value: USER_ID }, hasPermission });
        const response = await handler(createEvent({ resource: '/{id}/deactivate' }));
        expect(response.statusCode).toBe(403);
        expect(runController).toHaveBeenCalledTimes(1);
        expect(hasPermission).toHaveBeenCalledWith('administrador', 'workspaces', 'WorkspacesUpdate');
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
        const service = SERVICE_MANIFEST.find((service) => service.directory === 'kace_cloud_api_workspaces');
        expect(service.customRoutes).toContainEqual({ method: 'POST', resource: '/{id}/deactivate' });
    });
});
