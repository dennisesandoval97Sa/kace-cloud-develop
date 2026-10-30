import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import { createApiEvent, createAuthenticatedUser } from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/Controller.mjs';

const createRelationshipConnection = () => () => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    modify(callback) {
        callback?.(this);
        return this;
    },
    first: jest.fn(async () => ({ id: 'related-row' })),
});

const grantCreate = {
    agente: [
        {
            module_id: 'clients',
            name: 'ClientsCreate',
            granted: true,
        },
    ],
};

describe('Fake clients object identity authorization', () => {
    it('replaces body ids instead of mutating an existing fake client through POST /fake_clients', async () => {
        const existingId = 'abababab-abab-4bab-8bab-abababababab';
        const event = createApiEvent({
            body: {
                id: existingId,
                tipo_cliente: 'Natural',
                tipo_documento: 'CC',
                documento: '123',
                nombres: 'Unsafe update',
            },
        });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: grantCreate,
        });
        controller.clientRepository = {
            find: jest.fn(async () => null),
        };
        let createdValue;
        const updateExecute = jest.fn();
        controller.fakeClientCreatorFactory = () => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
            }),
        });
        controller.fakeClientUpdaterFactory = () => ({ execute: updateExecute });
        controller.repository = {
            table: createRelationshipConnection(),
            find: jest.fn(async (id) => (id.value === existingId ? { id: { value: existingId } } : null)),
        };

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.id).toEqual(expect.any(String));
        expect(createdValue.id).not.toBe(existingId);
        expect(updateExecute).not.toHaveBeenCalled();
    });

    it('replaces fake client create ids that collide with an existing real client', async () => {
        const existingId = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
        const event = createApiEvent({
            body: {
                id: existingId,
                tipo_cliente: 'Natural',
                tipo_documento: 'CC',
                documento: '456',
                nombres: 'Collision',
            },
        });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: grantCreate,
        });
        controller.clientRepository = {
            find: jest.fn(async () => ({ id: { value: existingId } })),
        };
        let createdValue;
        controller.fakeClientCreatorFactory = () => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
            }),
        });
        controller.repository = {
            table: createRelationshipConnection(),
            find: jest.fn(async () => null),
        };

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.id).toEqual(expect.any(String));
        expect(createdValue.id).not.toBe(existingId);
        expect(controller.clientRepository.find).not.toHaveBeenCalled();
    });

    it('updates an owned temp client draft by path id instead of re-sending create ids', async () => {
        const draftId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
        const event = createApiEvent({
            pathParameters: { id: draftId },
            body: {
                tipo_cliente: 'Natural',
                tipo_documento: 'CC',
                documento: '789',
                nombres: 'Owned draft',
            },
        });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: grantCreate,
        });
        const updateExecute = jest.fn(async () => {});
        controller.fakeClientUpdaterFactory = () => ({ execute: updateExecute });
        controller.repository = {
            table: createRelationshipConnection(),
            find: jest.fn(async () => ({ id: { value: draftId }, created_by: { value: controller.user.id.value } })),
        };

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBe(200);
        expect(updateExecute).toHaveBeenCalledWith(draftId, expect.objectContaining({ nombres: 'Owned draft' }));
    });
});
