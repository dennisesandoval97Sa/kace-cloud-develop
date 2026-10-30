import { jest } from '@jest/globals';
import { User } from '@kace/core/src/users/index.js';
import { ControllerAssociateInteractionToCaso } from '../src/ControllerAssociateInteractionToCaso.mjs';

const associationRepositoryDestroyConnection = jest.fn().mockResolvedValue(undefined);
const associationRepositoryInstances = [];
const caseRepositoryInstances = [];
const caseViewRepositoryInstances = [];
const interactionRepositoryInstances = [];
const associateExecute = jest.fn();
const linkedCasesExecute = jest.fn();
const resolveViewName = jest.fn();
const viewCaseSearcherExecute = jest.fn();

const KnexAssociateInteractionToCasoRepo = jest.fn().mockImplementation((knexConfig) => {
    const relationshipQuery = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        modify: jest.fn((callback) => {
            callback(relationshipQuery);
            return relationshipQuery;
        }),
        whereNull: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: interactionId }),
    };
    const repository = {
        knexConfig,
        destroyConnection: associationRepositoryDestroyConnection,
        table: jest.fn(() => relationshipQuery),
    };
    associationRepositoryInstances.push(repository);
    return repository;
});

const KnexCaseRepository = jest.fn().mockImplementation((knexConfig) => {
    const repository = { knexConfig };
    caseRepositoryInstances.push(repository);
    return repository;
});

const KnexViewCaseRepository = jest.fn().mockImplementation((databaseConnection, viewName) => {
    const repository = { databaseConnection, viewName };
    caseViewRepositoryInstances.push(repository);
    return repository;
});

const CaseViewNameResolver = jest.fn().mockImplementation((databaseConnection) => ({
    databaseConnection,
    resolve: resolveViewName,
}));

const ViewCaseSearcher = jest.fn().mockImplementation(() => ({
    execute: viewCaseSearcherExecute,
}));

const KnexInteractionRepository = jest.fn().mockImplementation((knexConfig) => {
    const repository = { knexConfig };
    interactionRepositoryInstances.push(repository);
    return repository;
});

const AssociateInteractionToCaso = jest.fn().mockImplementation(() => ({
    execute: associateExecute,
}));

const LinkedInteractionCasesFinder = jest.fn().mockImplementation(() => ({
    execute: linkedCasesExecute,
}));

const AssociateInteractionToCasoSearch = jest.fn();
const controllerDependencies = {
    KnexAssociateInteractionToCasoRepo,
    KnexCaseRepository,
    KnexViewCaseRepository,
    CaseViewNameResolver,
    ViewCaseSearcher,
    KnexInteractionRepository,
    AssociateInteractionToCaso,
    LinkedInteractionCasesFinder,
    AssociateInteractionToCasoSearch,
};

const interactionId = '6e5fd2e1-7a85-4fdb-b7a6-4d3f60901111';
const caseId = '6e5fd2e1-7a85-4fdb-b7a6-4d3f60902222';
const userId = '6e5fd2e1-7a85-4fdb-b7a6-4d3f60903333';

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

function eventFor(payload = { interaction_id: interactionId, caso_id: caseId }, originalResource = null) {
    const t = tenant();
    const event = {
        resource: '/interaction-cases',
        httpMethod: 'POST',
        path: '/interaction-cases',
        body: JSON.stringify(payload),
        headers: {},
        tenant: t,
        tenantContext: { tenant: t },
        kContext: { awsRequestId: 'test-request-id' },
    };
    if (originalResource) event.originalResource = originalResource;
    return event;
}

function linkedCasesEvent(id = interactionId, originalResource = null) {
    const t = tenant();
    const event = {
        resource: '/interaction-cases/{id}',
        httpMethod: 'GET',
        path: `/interaction-cases/${id}`,
        pathParameters: { id },
        body: null,
        headers: {},
        tenant: t,
        tenantContext: { tenant: t },
        kContext: { awsRequestId: 'test-request-id' },
    };
    if (originalResource) event.originalResource = originalResource;
    return event;
}

function candidateSearchPayload(overrides = {}) {
    return {
        filter: [
            { field: 'cases.cliente_id', operator: 'eq', value: 'client-1', type: 'AND' },
            { field: 'cases.deleted_at', operator: 'notNull', value: 'null', type: 'AND' },
            { field: 'cases.fecha_resolucion', operator: 'notNull', value: 'null', type: 'AND' },
            { field: 'id', operator: 'notIn', value: 'case-linked', type: 'AND' },
            {
                groupType: 'OR',
                filters: [
                    { field: 'view_casos.nivel1', operator: 'ilike', value: 'sftp', type: 'OR' },
                    { field: 'usuarios.login', operator: 'ilike', value: 'sftp', type: 'AND' },
                    { field: 'cases.created_by', operator: 'eq', value: 'user-2', type: 'OR' },
                    { field: 'reference', operator: 'eq', value: '123', type: 'OR' },
                ],
            },
        ],
        relationship: null,
        limit: 20,
        offset: 0,
        order: { field: 'created_at', direction: 'desc' },
        ...overrides,
    };
}

function candidateSearchEvent(payload = candidateSearchPayload()) {
    const t = tenant();

    return {
        resource: '/search',
        originalResource: '/interaction-cases/candidates/search',
        httpMethod: 'POST',
        path: '/interaction-cases/candidates/search',
        body: JSON.stringify(payload),
        headers: {},
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
        value: { value: '6e5fd2e1-7a85-4fdb-b7a6-4d3f60904444' },
    });
    Object.defineProperty(user, 'hasPermission', {
        value: hasPermission,
    });

    return user;
}

function controllerFor(event = eventFor(), user = userWithPermissions()) {
    const controller = new ControllerAssociateInteractionToCaso(event, knexConfig(), controllerDependencies);
    controller.user = user;
    controller.getGlobalConfig = jest.fn().mockResolvedValue({});

    return controller;
}

function responseJson(response) {
    return response.toJson();
}

describe('ControllerAssociateInteractionToCaso', () => {
    // The validation-failure case asserts the field-level detail, which the public
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
        associationRepositoryInstances.length = 0;
        caseRepositoryInstances.length = 0;
        caseViewRepositoryInstances.length = 0;
        interactionRepositoryInstances.length = 0;
        associateExecute.mockResolvedValue(undefined);
        linkedCasesExecute.mockResolvedValue(undefined);
        resolveViewName.mockResolvedValue('view_casos');
        viewCaseSearcherExecute.mockResolvedValue({
            toJson: () => ({
                data: [{ id: caseId, reference: 123 }],
                metadata: { count: 1 },
            }),
        });
    });

    it('allows agent interaction creators to create an interaction-case association', async () => {
        const hasPermission = jest.fn(
            (role, moduleId, permission) =>
                role === 'agente' && moduleId === 'interactions' && permission === 'InteractionsCreate'
        );
        const controller = controllerFor(eventFor(), userWithPermissions(hasPermission));

        const response = await controller.actionCreate();

        expect(responseJson(response).statusCode).toBe(200);
        expect(hasPermission).toHaveBeenCalledWith('administrador', 'interactions', 'InteractionsCreate');
        expect(hasPermission).toHaveBeenCalledWith('agente', 'interactions', 'InteractionsCreate');
        expect(AssociateInteractionToCaso).toHaveBeenCalledWith(
            associationRepositoryInstances[0],
            caseRepositoryInstances[0],
            interactionRepositoryInstances[0]
        );
        expect(associateExecute).toHaveBeenCalledWith(
            expect.objectContaining({
                interaction_id: interactionId,
                caso_id: caseId,
                created_by: userId,
            })
        );
    });

    it('rejects client-generated ids for an interaction-case association', async () => {
        const generatedId = 'b40ab260-4ae6-41c1-96ad-3cfe487acecd';
        const controller = controllerFor(
            eventFor({
                id: generatedId,
                interaction_id: interactionId,
                caso_id: caseId,
            }),
            userWithPermissions()
        );

        const response = await controller.actionCreate();

        expect(responseJson(response).statusCode).toBe(400);
        expect(JSON.parse(responseJson(response).body).errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ message: '"id" is not allowed' })])
        );
        expect(associateExecute).not.toHaveBeenCalled();
    });

    it('passes only server-derived scope on the Agent association route', async () => {
        const controller = controllerFor(eventFor(undefined, '/agent/interaction-cases'), userWithPermissions());

        await controller.actionCreate();

        expect(associateExecute).toHaveBeenCalledWith(
            expect.objectContaining({ interaction_id: interactionId, caso_id: caseId }),
            { userId, activeGroupId: '6e5fd2e1-7a85-4fdb-b7a6-4d3f60904444' }
        );
    });

    it('returns forbidden before associating when the user lacks admin and agent permissions', async () => {
        const hasPermission = jest.fn(() => false);
        const controller = controllerFor(eventFor(), userWithPermissions(hasPermission));

        const response = await controller.actionCreate();

        expect(responseJson(response).statusCode).toBe(403);
        expect(AssociateInteractionToCaso).not.toHaveBeenCalled();
        expect(associateExecute).not.toHaveBeenCalled();
    });

    it('allows agent interaction creators to read linked case ids for an interaction', async () => {
        linkedCasesExecute.mockResolvedValue({
            case_ids: [caseId],
            items: [{ id: caseId, reference: 123 }],
        });
        const hasPermission = jest.fn(
            (role, moduleId, permission) =>
                role === 'agente' && moduleId === 'interactions' && permission === 'InteractionsCreate'
        );
        const controller = controllerFor(linkedCasesEvent(), userWithPermissions(hasPermission));

        const response = await controller.actionRead();

        expect(responseJson(response).statusCode).toBe(200);
        expect(LinkedInteractionCasesFinder).toHaveBeenCalledWith(
            associationRepositoryInstances[0],
            caseRepositoryInstances[0]
        );
        expect(linkedCasesExecute).toHaveBeenCalledWith(interactionId);
        expect(JSON.parse(responseJson(response).body).data).toEqual({
            case_ids: [caseId],
            items: [{ id: caseId, reference: 123 }],
        });
    });

    it('returns forbidden when reading linked cases without interaction permissions', async () => {
        const controller = controllerFor(linkedCasesEvent(), userWithPermissions(jest.fn(() => false)));

        const response = await controller.actionRead();

        expect(responseJson(response).statusCode).toBe(403);
        expect(LinkedInteractionCasesFinder).not.toHaveBeenCalled();
    });

    it('passes server-derived scope on the Agent linked-case read route', async () => {
        linkedCasesExecute.mockResolvedValue({ case_ids: [], items: [] });
        const controller = controllerFor(
            linkedCasesEvent(interactionId, '/agent/interaction-cases/{id}'),
            userWithPermissions()
        );

        await controller.actionRead();

        expect(LinkedInteractionCasesFinder).toHaveBeenCalledWith(
            associationRepositoryInstances[0],
            caseRepositoryInstances[0],
            interactionRepositoryInstances[0]
        );
        expect(linkedCasesExecute).toHaveBeenCalledWith(interactionId, {
            userId,
            activeGroupId: '6e5fd2e1-7a85-4fdb-b7a6-4d3f60904444',
        });
    });

    it('allows agent interaction creators without cases read permission to search candidate cases', async () => {
        const hasPermission = jest.fn(
            (role, moduleId, permission) =>
                role === 'agente' && moduleId === 'interactions' && permission === 'InteractionsCreate'
        );
        const controller = controllerFor(candidateSearchEvent(), userWithPermissions(hasPermission));

        const response = await controller.actionSearch();

        expect(responseJson(response).statusCode).toBe(200);
        expect(hasPermission).toHaveBeenCalledWith('administrador', 'interactions', 'InteractionsRead');
        expect(hasPermission).toHaveBeenCalledWith('agente', 'interactions', 'InteractionsCreate');
        expect(hasPermission).not.toHaveBeenCalledWith(expect.any(String), 'cases', 'CasesRead');
        expect(CaseViewNameResolver).toHaveBeenCalled();
        expect(KnexViewCaseRepository).toHaveBeenCalledWith(expect.any(Function), 'view_casos');
        expect(ViewCaseSearcher).toHaveBeenCalledWith(caseViewRepositoryInstances[0]);
        expect(viewCaseSearcherExecute).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));
    });

    it('returns forbidden for candidate case search without interaction permissions', async () => {
        const controller = controllerFor(candidateSearchEvent(), userWithPermissions(jest.fn(() => false)));

        const response = await controller.actionSearch();

        expect(responseJson(response).statusCode).toBe(403);
        expect(ViewCaseSearcher).not.toHaveBeenCalled();
        expect(viewCaseSearcherExecute).not.toHaveBeenCalled();
    });

    it('returns validation failure for candidate case search without a selected client filter', async () => {
        const hasPermission = jest.fn(
            (role, moduleId, permission) =>
                role === 'agente' && moduleId === 'interactions' && permission === 'InteractionsCreate'
        );
        const controller = controllerFor(
            candidateSearchEvent(
                candidateSearchPayload({
                    filter: [
                        {
                            groupType: 'AND',
                            filters: [{ field: 'nivel1', operator: 'ilike', value: 'sftp', type: 'OR' }],
                        },
                    ],
                })
            ),
            userWithPermissions(hasPermission)
        );

        const response = await controller.actionSearch();

        expect(responseJson(response).statusCode).toBe(400);
        expect(JSON.parse(responseJson(response).body).errors).toEqual([
            {
                field: 'filter',
                message: 'A selected client filter is required for candidate case search.',
            },
        ]);
        expect(ViewCaseSearcher).not.toHaveBeenCalled();
        expect(viewCaseSearcherExecute).not.toHaveBeenCalled();
    });

    it('sanitizes candidate case search criteria before forwarding to the case view searcher', async () => {
        const hasPermission = jest.fn(
            (role, moduleId, permission) =>
                role === 'agente' && moduleId === 'interactions' && permission === 'InteractionsCreate'
        );
        const controller = controllerFor(candidateSearchEvent(), userWithPermissions(hasPermission));

        const response = await controller.actionSearch();

        expect(responseJson(response).statusCode).toBe(200);
        const forwardedCriteria = viewCaseSearcherExecute.mock.calls[0][0];
        expect(forwardedCriteria).toEqual(
            expect.objectContaining({
                relationship: null,
                limit: 20,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
                filter: [
                    { field: 'cliente_id', operator: 'eq', value: 'client-1', type: 'AND' },
                    { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
                    { field: 'fecha_resolucion', operator: 'null', value: 'null', type: 'AND' },
                    { field: 'id', operator: 'notIn', value: 'case-linked', type: 'AND' },
                    {
                        groupType: 'AND',
                        filters: [
                            { field: 'nivel1', operator: 'ilike', value: 'sftp', type: 'OR' },
                            { field: 'login', operator: 'ilike', value: 'sftp', type: 'OR' },
                            { field: 'reference', operator: 'eq', value: '123', type: 'OR' },
                        ],
                    },
                ],
            })
        );
        expect(forwardedCriteria.filter).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'deleted_at', operator: 'notNull' })])
        );
        expect(forwardedCriteria.filter).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'created_by' })])
        );
        expect(forwardedCriteria.filter).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'fecha_resolucion', operator: 'notNull' })])
        );
    });
});
