import { jest } from '@jest/globals';

const E2E_USER_SUB = '54e8d4f8-3091-7077-0002-0e8dfcdf6d7b';
const E2E_USER_EMAIL = 'usertest.e2e@konecta.com';
const TEST_TOKEN = 'ci-e2e-token';

process.env.AWS_COGNITO_USER_POOL_ID = 'us-east-1_localpool';
process.env.AWS_COGNITO_APP_CLIENT_ID = 'local-client';

const verifyJwt = jest.fn().mockResolvedValue({
    sub: E2E_USER_SUB,
    email: E2E_USER_EMAIL,
    exp: Math.floor(Date.now() / 1000) + 3600,
});

const { BaseController } = await import('@kace/api-common/src/controllers/BaseController.js');
const verifyJwtSpy = jest.spyOn(BaseController.prototype, 'verifyJwt').mockImplementation(verifyJwt);
const { handler } = await import('../src/handler.mjs');
const { TestHelper } = await import('@kace/api-common/tests/helpers/TestHelper.js');
const { Interaction } = await import('@kace/core/src/interactions/domain/Interaction.js');
const { KnexInteractionRepository } =
    await import('@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository.js');
const { KnexWorkspacesRepository } =
    await import('@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js');
const { default: InteractionMother } = await import('@kace/core/tests/interactions/domain/InteractionMother.js');
const { default: WorkspaceMother } = await import('@kace/core/tests/workspaces/domain/WorkspaceMother.js');

const tenant = await TestHelper.getTenant();
const interactionRepository = new KnexInteractionRepository(tenant.buildKnexConfig());
const workspaceRepository = new KnexWorkspacesRepository(interactionRepository.connection);

function eventFor({ resource, path = resource, body }) {
    return {
        resource,
        path,
        httpMethod: 'POST',
        body: JSON.stringify(body),
        headers: {
            Authorization: TEST_TOKEN,
            Host: '127.0.0.1',
            'X-Client-Fingerprint': 'ci-e2e-fingerprint',
            'X-Tenant-Id': tenant.id.value,
        },
        requestContext: {
            requestId: 'interaction-admin-search-e2e',
        },
    };
}

function searchCriteria(workspaceId) {
    return {
        filter: [
            { field: 'workspace_id', operator: 'eq', value: workspaceId, type: 'AND' },
            { field: 'deleted_at', operator: 'null', value: '', type: 'AND' },
        ],
        relationship: null,
        limit: 10,
        offset: 0,
        order: { field: 'created_at', direction: 'desc' },
    };
}

async function invoke(event) {
    const response = await handler(event, { awsRequestId: event.requestContext.requestId });

    return {
        statusCode: response.statusCode,
        body: JSON.parse(response.body),
    };
}

describe('Interaction admin-search Lambda E2E', () => {
    beforeAll(() => {
        if (!process.env.DB_TEST_SCHEMA?.startsWith('tmp_')) {
            throw new Error('Interaction E2E requires a unique DB_TEST_SCHEMA with the tmp_ prefix.');
        }
        if (process.env.ALLOW_SCHEMA_RESET !== 'true') {
            throw new Error('Interaction E2E requires ALLOW_SCHEMA_RESET=true.');
        }
    });

    beforeEach(async () => {
        verifyJwt.mockClear();
        await TestHelper.resetSchemaAndMigrate(tenant);
    });

    afterAll(async () => {
        verifyJwtSpy.mockRestore();
        await workspaceRepository.connection.destroy();
        await interactionRepository.connection.destroy();
    });

    it('rejects a client-generated interaction-case association id', async () => {
        const response = await invoke(
            eventFor({
                resource: '/interaction-cases',
                body: {
                    id: 'b40ab260-4ae6-41c1-96ad-3cfe487acecd',
                    interaction_id: '6e5fd2e1-7a85-4fdb-b7a6-4d3f60901111',
                    caso_id: '6e5fd2e1-7a85-4fdb-b7a6-4d3f60902222',
                },
            })
        );

        expect(response.statusCode).toBe(400);
    });

    it('excludes inactive-workspace interactions from both rows and metadata count', async () => {
        const activeWorkspace = await WorkspaceMother.createWorkspace(workspaceRepository, {
            is_active: true,
        });
        const inactiveWorkspace = await WorkspaceMother.createWorkspace(workspaceRepository, {
            is_active: false,
        });
        const activeInteraction = Interaction.create(InteractionMother.dto({ workspace_id: activeWorkspace.id.value }));
        const inactiveInteraction = Interaction.create(
            InteractionMother.dto({ workspace_id: inactiveWorkspace.id.value })
        );
        await interactionRepository.save(activeInteraction);
        await interactionRepository.save(inactiveInteraction);

        const activeResponse = await invoke(
            eventFor({
                resource: '/search',
                body: searchCriteria(activeWorkspace.id.value),
            })
        );
        const inactiveResponse = await invoke(
            eventFor({
                resource: '/search',
                body: searchCriteria(inactiveWorkspace.id.value),
            })
        );

        expect(activeResponse.statusCode).toBe(200);
        expect(activeResponse.body.data.items.map(({ id }) => id)).toEqual([activeInteraction.id.value]);
        expect(activeResponse.body.metadata.count).toBe(1);
        expect(inactiveResponse.statusCode).toBe(200);
        expect(inactiveResponse.body.data.items).toEqual([]);
        expect(inactiveResponse.body.metadata.count).toBe(0);
        expect(verifyJwt).toHaveBeenCalledWith(TEST_TOKEN);
    });
});
