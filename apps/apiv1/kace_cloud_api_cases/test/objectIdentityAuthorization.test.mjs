import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

const CASE_ID = '55555555-5555-4555-8555-555555555555';
const CLIENT_ID = '66666666-6666-4666-8666-666666666666';
const TRANSITION_ID = '77777777-7777-4777-8777-777777777777';
const RESPONSIBLE_ID = '88888888-8888-4888-8888-888888888888';
const CLASSIFICATION_ID = '99999999-9999-4999-8999-999999999999';
const GROUP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const validCasePayload = (overrides = {}) => ({
    id: CASE_ID,
    cliente_id: CLIENT_ID,
    transicion_id: TRANSITION_ID,
    responsable_id: RESPONSIBLE_ID,
    clasificacion_id: CLASSIFICATION_ID,
    grupo_id: GROUP_ID,
    descripcion_caso: 'Security regression case',
    ...overrides,
});

const createRelationshipConnection = ({ missingTables = [] } = {}) => {
    return (table) => {
        const query = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            whereNull: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            modify(callback) {
                callback?.(this);
                return this;
            },
            first: jest.fn(async () => (missingTables.includes(table) ? null : { id: `${table}-row` })),
        };
        return query;
    };
};

const instantiateController = ({ body, missingTables = [] } = {}) => {
    const controller = new Controller(createApiEvent({ body }), knexConfig);
    controller.user = createAuthenticatedUser({
        permissions: {
            agente: [permission('agente', 'cases', 'CasesCreate')],
        },
    });
    controller.started_at = new Date('2026-04-23T12:00:00.000Z');
    controller.repository = {
        table: createRelationshipConnection({ missingTables }),
        find: jest.fn(async () => null),
        withTransaction: jest.fn(async (callback) => callback({ trx: true })),
    };
    controller.fakeCaseRepository = {
        find: jest.fn(async () => null),
    };
    controller.caseCreatorFactory = () => ({
        execute: jest.fn(async (value) => ({
            response: { toJson: () => ({ data: { id: value.id } }) },
            kase: { id: { value: value.id } },
        })),
        runPostPersistence: jest.fn(async () => {}),
    });
    controller.fakeCaseCreatorFactory = () => ({ execute: jest.fn(async () => {}) });
    controller.fakeCaseUpdaterFactory = () => ({ execute: jest.fn(async () => {}) });
    return controller;
};

describe('Cases object identity authorization', () => {
    it('accepts a legacy request-body id that does not collide with an existing case', async () => {
        const controller = instantiateController({
            body: validCasePayload(),
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(response.data.id).toBe(CASE_ID);
    });

    it('rejects create ids that collide with an existing case', async () => {
        const controller = instantiateController({
            body: validCasePayload(),
        });
        controller.repository.find = jest.fn(async () => ({ id: { value: CASE_ID } }));

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(400);
    });

    it('rejects malformed request-body ids', async () => {
        const controller = instantiateController({
            body: validCasePayload({ id: 'not-a-uuid' }),
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(400);
    });

    it('rejects related client references that are missing or inaccessible', async () => {
        const controller = instantiateController({
            body: validCasePayload({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
            missingTables: ['clients'],
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(404);
        expect(controller.fakeCaseRepository.find).not.toHaveBeenCalled();
    });

    it('rejects fake-case draft synchronization for drafts owned by another user', async () => {
        const controller = instantiateController({
            body: validCasePayload({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
        });
        controller.fakeCaseRepository.find = jest.fn(async (id) =>
            id.value === 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
                ? {
                      id: { value: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
                      created_by: { value: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
                  }
                : null
        );

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(403);
    });

    it('synchronizes fake-case drafts owned by the authenticated user', async () => {
        const controller = instantiateController({
            body: validCasePayload({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
        });
        const fakeCaseUpdater = { execute: jest.fn(async () => {}) };
        controller.fakeCaseUpdaterFactory = () => fakeCaseUpdater;
        controller.fakeCaseRepository.find = jest.fn(async (id) =>
            id.value === 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
                ? {
                      id: { value: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
                      created_by: { value: controller.user.id.value },
                  }
                : null
        );

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(response.data.id).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
        expect(fakeCaseUpdater.execute).toHaveBeenCalledWith(
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            expect.any(Object)
        );
    });

    it('creates the case inside a transaction with the folio resolver and runs side-effects after commit', async () => {
        const controller = instantiateController({
            body: validCasePayload({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }),
        });
        const creator = {
            execute: jest.fn(async (value) => ({
                response: { toJson: () => ({ data: { id: value.id } }) },
                kase: { id: { value: value.id } },
            })),
            runPostPersistence: jest.fn(async () => {}),
        };
        controller.caseCreatorFactory = () => creator;

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(controller.repository.withTransaction).toHaveBeenCalledTimes(1);
        expect(creator.execute).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }),
            { trx: { trx: true }, folioResolver: controller.caseFolioResolver }
        );
        expect(creator.runPostPersistence).toHaveBeenCalledWith({
            id: { value: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
        });
    });

    it('still answers 201 when post-commit side-effects fail', async () => {
        const controller = instantiateController({
            body: validCasePayload({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }),
        });
        const creator = {
            execute: jest.fn(async (value) => ({
                response: { toJson: () => ({ data: { id: value.id } }) },
                kase: { id: { value: value.id } },
            })),
            runPostPersistence: jest.fn(async () => {
                throw new Error('event bus down');
            }),
        };
        controller.caseCreatorFactory = () => creator;

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
    });
});
