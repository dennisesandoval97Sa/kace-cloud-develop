import { jest } from '@jest/globals';
import { createApiEvent, createAuthenticatedUser } from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';

// Mock the searcher and the persistence/read-model modules so the controller can be
// exercised in-process without a database (and without the heavy MailAccount/templates
// import chain the persistence layer drags in). The REAL SearchAuthorizationService +
// policy still run, so this suite is what fails if someone re-adds
// s3_import_files.created_by to allowedFilters or drops the server-side scoping injection.
const searcherExecute = jest.fn();
jest.unstable_mockModule(
    '@kace/core/src/imports/application/imports-dashboard/search/ImportsDashboardSearcher',
    () => ({
        ImportsDashboardSearcher: jest.fn().mockImplementation(() => ({ execute: searcherExecute })),
    })
);
jest.unstable_mockModule('@kace/core/src/imports/infrastructure/persistence/KnexS3ImportFiles.js', () => ({
    KnexS3ImportFiles: jest.fn().mockImplementation(() => ({ destroyConnection: async () => {} })),
}));
jest.unstable_mockModule('@kace/core/src/imports/application/imports-dashboard/S3ImportsDashboard', () => ({
    S3ImportsDashboard: jest.fn().mockImplementation(() => ({ execute: async () => ({ toJson: () => ({}) }) })),
}));

const { Controller } = await import('../src/controller.mjs');

// Valid enough for Knex() to build a client without ever opening a connection
// (the repositories that would query are mocked away).
const knexConfig = { client: 'pg', connection: {} };

const readImportsPermission = { module_id: 'imports-dashboard', name: 'ImportsDashboardRead', granted: true };

const makeController = ({ body = {}, permissions = { administrador: [readImportsPermission] } } = {}) => {
    const event = createApiEvent({ body, resource: '/search', httpMethod: 'POST' });
    const controller = new Controller(event, knexConfig);
    controller.user = createAuthenticatedUser({ permissions });
    return controller;
};

const validPayload = (filter = []) => ({ filter, limit: null, offset: null });

describe('imports-dashboard actionSearch per-user scoping', () => {
    beforeEach(() => {
        searcherExecute.mockReset();
        searcherExecute.mockResolvedValue({ toJson: () => ({ data: { items: [] }, metadata: { count: 0 } }) });
    });

    it('injects the caller created_by filter server-side even when the payload sends no filters', async () => {
        const controller = makeController({ body: validPayload([]) });
        const expectedUserId = controller.user.id?.value ?? controller.user.id;

        const response = await controller.actionSearch();

        expect(response.statusCode).toBe(200);
        expect(searcherExecute).toHaveBeenCalledTimes(1);
        const scopedQuery = searcherExecute.mock.calls[0][0];
        expect(scopedQuery.filter).toContainEqual({
            field: 's3_import_files.created_by',
            operator: 'eq',
            value: expectedUserId,
            type: 'AND',
        });
    });

    it('rejects a payload that tries to filter by another user created_by with 403', async () => {
        const foreignUserId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
        const controller = makeController({
            body: validPayload([
                { field: 's3_import_files.created_by', operator: 'eq', value: foreignUserId, type: 'AND' },
            ]),
        });

        const response = await controller.actionSearch();

        expect(response.statusCode).toBe(403);
        expect(searcherExecute).not.toHaveBeenCalled();
    });

    it('returns 403 when the caller lacks the imports-dashboard read permission', async () => {
        const controller = makeController({ body: validPayload([]), permissions: { administrador: [] } });

        const response = await controller.actionSearch();

        expect(response.statusCode).toBe(403);
        expect(searcherExecute).not.toHaveBeenCalled();
    });

    it('returns 401 when the authenticated user id cannot be resolved', async () => {
        const controller = makeController({ body: validPayload([]) });
        // Simulate a corrupt/edge-case token where the user id is absent.
        Object.defineProperty(controller.user, 'id', { value: null, configurable: true });

        const response = await controller.actionSearch();

        expect(response.statusCode).toBe(401);
        expect(searcherExecute).not.toHaveBeenCalled();
    });
});
