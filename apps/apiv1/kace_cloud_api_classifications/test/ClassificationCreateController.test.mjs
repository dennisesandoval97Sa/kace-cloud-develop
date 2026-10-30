import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { ClassificationCreator } from '@kace/core/src/classifications';
import { ValidationFailError } from '@kace/core/src/shared/errors/ValidationFailError.js';
import { CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND } from '@kace/error-codes';
import { Controller } from '../src/Controller.mjs';

const CLIENT_CLASSIFICATION_ID = '11111111-1111-4111-8111-111111111111';
const FLOW_ID = '22222222-2222-4222-8222-222222222222';
const ANS_ID = '33333333-3333-4333-8333-333333333333';
const TEMPLATE_ID = '44444444-4444-4444-8444-444444444444';

const sqliteConfig = {
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
};

const createAllowedRelationshipQuery = () => {
    const query = {
        select: jest.fn(() => query),
        where: jest.fn(() => query),
        whereNull: jest.fn(() => query),
        andWhere: jest.fn(() => query),
        modify: jest.fn((callback) => {
            callback(query);
            return query;
        }),
        first: jest.fn(async () => ({ id: FLOW_ID })),
    };
    return query;
};

const createRepositoryStub = () => ({
    connection: jest.fn(() => createAllowedRelationshipQuery()),
    qualifiedName: jest.fn((table) => table),
    table: jest.fn(() => createAllowedRelationshipQuery()),
});

const validPayload = () => ({
    id: CLIENT_CLASSIFICATION_ID,
    nivel1: 'Support',
    flujo_id: FLOW_ID,
    ans_id: ANS_ID,
    template_ids: [TEMPLATE_ID, TEMPLATE_ID],
});

const controllers = [];

const instantiateController = async () => {
    const controller = new Controller(createApiEvent({ body: validPayload() }), sqliteConfig);
    const ownedRepository = controller.repository;
    await ownedRepository.destroyConnection();
    controller.repository = createRepositoryStub();
    controller.user = createAuthenticatedUser({
        permissions: {
            administrador: [permission('administrador', 'classifications', 'ClassificationCreate')],
        },
    });
    controller.started_at = new Date('2026-07-09T12:00:00.000Z');
    controllers.push(controller);
    return controller;
};

afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all(controllers.splice(0).map((controller) => controller.database_connection.destroy()));
});

describe('ClassificationController.actionCreate', () => {
    it('returns the canonical server-generated id and passes deduplicated template ids to the creator', async () => {
        let createdDto;
        jest.spyOn(ClassificationCreator.prototype, 'execute').mockImplementation(async (dto) => {
            createdDto = dto;
        });
        const controller = await instantiateController();

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdDto.id).not.toBe(CLIENT_CLASSIFICATION_ID);
        expect(createdDto.template_ids).toEqual([TEMPLATE_ID]);
        expect(response.data).toEqual({ id: createdDto.id });
    });

    it('maps an unknown template validation failure to its public 400 response', async () => {
        jest.spyOn(ClassificationCreator.prototype, 'execute').mockRejectedValue(
            new ValidationFailError(
                'One or more template_ids do not exist',
                'template_ids',
                [],
                CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND
            )
        );
        const controller = await instantiateController();

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(400);
        expect(response.publicErrorCode).toBe(CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND);
    });
});
