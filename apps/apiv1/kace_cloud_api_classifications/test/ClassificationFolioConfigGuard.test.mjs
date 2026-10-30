import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { ClassificationCreator, ClassificationUpdater } from '@kace/core/src/classifications';
import { Controller } from '../src/Controller.mjs';

const CLASSIFICATION_ID = '11111111-1111-4111-8111-111111111111';
const FLOW_ID = '22222222-2222-4222-8222-222222222222';
const ANS_ID = '33333333-3333-4333-8333-333333333333';
const FOLIO_CONFIG_ID = '55555555-5555-4555-8555-555555555555';

/** Never queried: the repository is replaced by a stub right after construction. */
const unusedPgConfig = { client: 'pg', connection: { host: '127.0.0.1', port: 1 }, pool: { min: 0, max: 1 } };

/** Every relationship exists except the folio configuration, which reads as deleted/missing. */
function createRepositoryStub() {
    const folioQueries = [];
    const query = (table) => {
        const builder = {
            select: jest.fn(() => builder),
            where: jest.fn(() => builder),
            whereNull: jest.fn(() => builder),
            andWhere: jest.fn(() => builder),
            modify: jest.fn((callback) => {
                callback(builder);
                return builder;
            }),
            first: jest.fn(async () => (table === 'folio_configurations' ? undefined : { id: FLOW_ID })),
        };
        if (table === 'folio_configurations') folioQueries.push(builder);
        return builder;
    };
    return {
        folioQueries,
        connection: jest.fn((table) => query(table)),
        qualifiedName: jest.fn((table) => table),
        table: jest.fn(() => query('classifications')),
    };
}

const controllers = [];

async function instantiate({ resource, pathParameters, body, permissionName }) {
    const controller = new Controller(createApiEvent({ resource, pathParameters, body }), unusedPgConfig);
    await controller.repository.destroyConnection();
    controller.repository = createRepositoryStub();
    controller.user = createAuthenticatedUser({
        permissions: { administrador: [permission('administrador', 'classifications', permissionName)] },
    });
    controller.started_at = new Date('2026-10-15T12:00:00.000Z');
    controllers.push(controller);
    return controller;
}

afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all(controllers.splice(0).map((controller) => controller.database_connection.destroy()));
});

describe('Clasificaciones — folio_config_id debe apuntar a una configuración existente y no borrada', () => {
    it('al crear', async () => {
        const creator = jest.spyOn(ClassificationCreator.prototype, 'execute').mockResolvedValue(undefined);
        const controller = await instantiate({
            resource: '/',
            body: {
                id: CLASSIFICATION_ID,
                nivel1: 'Soporte',
                flujo_id: FLOW_ID,
                ans_id: ANS_ID,
                folio_config_id: FOLIO_CONFIG_ID,
            },
            permissionName: 'ClassificationCreate',
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
        expect(creator).not.toHaveBeenCalled();
        expect(controller.repository.folioQueries[0].whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('al actualizar', async () => {
        const updater = jest.spyOn(ClassificationUpdater.prototype, 'execute').mockResolvedValue(undefined);
        const controller = await instantiate({
            resource: '/{id}',
            pathParameters: { id: CLASSIFICATION_ID },
            body: { folio_config_id: FOLIO_CONFIG_ID },
            permissionName: 'ClassificationUpdate',
        });

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
        expect(updater).not.toHaveBeenCalled();
        expect(controller.repository.folioQueries[0].whereNull).toHaveBeenCalledWith('deleted_at');
    });
});
