import { jest } from '@jest/globals';

const queueDeleteTagFlow = jest.fn();
const deleteWorkspace = jest.fn();
const hasPermission = jest.fn();
const logError = jest.fn();

const WORKSPACE_ID = '95346f17-4ee8-420d-a0af-16d2ac394dd9';
const USER_ID = '6bae1fbf-afd4-4bd0-b07e-24ed9dc5a13e';
const TENANT_ID = 'ce9a7b58-13c1-4b2b-a8d3-bad322beefac';
const KACE_API_BASE_URL = 'https://correos-api.kace-cloudtest.com/';

jest.unstable_mockModule('@kace/api-common', () => ({
    Response: class {
        constructor(payload) {
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
        validationsFail: (payload) => ({ toJson: () => ({ statusCode: 400, body: JSON.stringify(payload) }) }),
        internalServerError: (payload) => ({ toJson: () => ({ statusCode: 500, body: JSON.stringify(payload) }) }),
    },
    BaseController: class {
        constructor(event, knexConfig) {
            this.event = event;
            this.knexConfig = knexConfig;
            this.database_connection = knexConfig;
            this.eventPublisher = { publish: jest.fn() };
            this.tenant = {
                id: { value: TENANT_ID },
                apps_execute_rest_hook_service_url: { value: KACE_API_BASE_URL },
            };
        }
        pathParameters() {
            return this.event.pathParameters ?? {};
        }
        validateId(id) {
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        }
    },
}));

jest.unstable_mockModule('@kace/api-common/src/validation/schemas/SearchSchema', () => ({
    SearchSchema: { validate: jest.fn((value) => ({ value })) },
}));

const workspaceRepository = { repositoryName: 'workspaces' };
jest.unstable_mockModule('@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js', () => ({
    KnexWorkspacesRepository: jest.fn().mockImplementation(() => workspaceRepository),
}));

const executionRepository = { repositoryName: 'ws-rest-flow-executions' };
jest.unstable_mockModule('@kace/core/src/ws-rest-flow-executions/index.js', () => ({
    KnexWSRestFlowExecutionRepository: jest.fn().mockImplementation(() => executionRepository),
}));

jest.unstable_mockModule(
    '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js',
    () => ({
        KnexWSRestWorkflowStepRepository: jest.fn().mockImplementation(() => ({})),
    })
);

jest.unstable_mockModule(
    '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js',
    () => ({
        KnexAllowedConnectionsRepository: jest.fn().mockImplementation(() => ({})),
    })
);

jest.unstable_mockModule(
    '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js',
    () => ({
        KnexSecretsVaultRepository: jest.fn().mockImplementation(() => ({})),
    })
);

jest.unstable_mockModule('@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor.js', () => ({
    WorkflowExecutor: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn(), logError },
}));

jest.unstable_mockModule('@kace/core/src/workspaces/application/create/WorkspaceCreator.js', () => ({
    WorkspaceCreator: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/delete/WorkspaceDeleter.js', () => ({
    WorkspaceDeleter: jest.fn().mockImplementation(() => ({ execute: deleteWorkspace })),
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
    WorkspaceTagUpdateFlowQueuer: jest.fn().mockImplementation(() => ({ execute: queueDeleteTagFlow })),
    buildChannelHubTagContext: jest.fn(),
}));

const { Controller } = await import('../src/Controller.mjs');
const { WorkspaceTagUpdateFlowQueuer } = await import('../src/WorkspaceTagUpdateFlowQueuer.mjs');

const createController = ({ pathId = WORKSPACE_ID } = {}) => {
    const controller = new Controller(
        {
            pathParameters: { id: pathId },
        },
        { client: 'mock' }
    );
    controller.user = { id: { value: USER_ID }, hasPermission };
    return controller;
};

describe('Workspace delete tag RestFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        hasPermission.mockReturnValue(true);
        queueDeleteTagFlow.mockResolvedValue(true);
        deleteWorkspace.mockResolvedValue(undefined);
    });

    it('queues the delete tag RestFlow before soft-deleting the workspace', async () => {
        const controller = createController();

        const response = await controller.actionDelete();

        expect(response.toJson().statusCode).toBe(200);
        expect(WorkspaceTagUpdateFlowQueuer).toHaveBeenCalledWith({
            workspaceRepository,
            executionRepository,
            eventPublisher: controller.eventPublisher,
            currentUser: controller.user,
            metadata: {
                tenant_id: TENANT_ID,
                user_id: USER_ID,
            },
            kaceApiBaseUrl: KACE_API_BASE_URL,
        });
        expect(queueDeleteTagFlow).toHaveBeenCalledWith(WORKSPACE_ID, 'delete');
        expect(deleteWorkspace).toHaveBeenCalledWith(
            WORKSPACE_ID,
            expect.objectContaining({
                deleted_at: expect.any(String),
                deleted_by: USER_ID,
            })
        );
        expect(queueDeleteTagFlow.mock.invocationCallOrder[0]).toBeLessThan(
            deleteWorkspace.mock.invocationCallOrder[0]
        );
    });

    it('does not soft-delete the workspace when queueing the delete tag RestFlow fails', async () => {
        queueDeleteTagFlow.mockRejectedValue(new Error('EventBridge publish failed'));

        const response = await createController().actionDelete();

        expect(response.toJson().statusCode).toBe(500);
        expect(deleteWorkspace).not.toHaveBeenCalled();
        expect(logError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('does not queue or delete when the workspace id is invalid', async () => {
        const response = await createController({ pathId: 'not-a-uuid' }).actionDelete();

        expect(response.toJson().statusCode).toBe(400);
        expect(queueDeleteTagFlow).not.toHaveBeenCalled();
        expect(deleteWorkspace).not.toHaveBeenCalled();
    });
});
