import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/Controller.mjs';

const LEGACY_ID = '11111111-1111-4111-8111-111111111111';
const COLLIDING_ID = '22222222-2222-4222-8222-222222222222';
const EXISTING_ID = '33333333-3333-4333-8333-333333333333';

const validClientPayload = (overrides = {}) => ({
    tipo_cliente: 'Natural',
    tipo_documento: 'CC',
    documento: '123456',
    nombres: 'Juan',
    fecha_nacimiento: '2000-01-01',
    habeas_data: 'SI',
    status: 1,
    ...overrides,
});

const createNoopConnection = () => () => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    modify(callback) {
        callback?.(this);
        return this;
    },
    first: jest.fn(async () => ({ id: LEGACY_ID })),
});

const instantiateController = ({ body, pathParameters = {}, permissions = {} } = {}) => {
    const controller = new Controller(createApiEvent({ body, pathParameters }), knexConfig);
    controller.user = createAuthenticatedUser({ permissions });
    controller.started_at = new Date('2026-04-23T12:00:00.000Z');
    controller.globalValidationService = { validateFields: jest.fn(async () => {}) };
    controller.repository = {
        table: createNoopConnection(),
        find: jest.fn(async () => null),
        findByIdentification: jest.fn(async () => null),
    };
    controller.fakeClientRepository = {
        find: jest.fn(async () => null),
    };

    return controller;
};

const grantCreate = () => ({
    agente: [permission('agente', 'clients', 'ClientsCreate')],
});

const grantCreateAndUpdate = () => ({
    agente: [permission('agente', 'clients', 'ClientsCreate'), permission('agente', 'clients', 'ClientsUpdate')],
});

const grantAdminUpdate = () => ({
    agente: [],
    administrador: [permission('administrador', 'clients', 'ClientsUpdate')],
});

const grantAdminDelete = () => ({
    agente: [],
    administrador: [permission('administrador', 'clients', 'ClientsDelete')],
});

describe('Clients object identity authorization', () => {
    it('does not let create-only callers update an existing client matched by document fields', async () => {
        const controller = instantiateController({
            body: validClientPayload(),
            permissions: grantCreate(),
        });
        const updateExecute = jest.fn(async () => {});
        controller.repository.findByIdentification = jest.fn(async () => ({ id: { value: EXISTING_ID } }));
        controller.clientUpdaterFactory = () => ({ execute: updateExecute });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(403);
        expect(updateExecute).not.toHaveBeenCalled();
    });

    it('generates a server-side id when POST /clients omits one', async () => {
        let createdValue;
        const controller = instantiateController({
            body: validClientPayload(),
            permissions: grantCreate(),
        });
        controller.clientCreatorFactory = () => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
            }),
        });
        controller.fakeClientCreatorFactory = () => ({ execute: jest.fn(async () => {}) });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.id).toEqual(expect.any(String));
        expect(createdValue.id).not.toBeUndefined();
    });

    it('replaces a safe request-body id with a server-owned id', async () => {
        let createdValue;
        const controller = instantiateController({
            body: validClientPayload({ id: LEGACY_ID }),
            permissions: grantCreate(),
        });
        controller.clientCreatorFactory = () => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
            }),
        });
        controller.fakeClientCreatorFactory = () => ({ execute: jest.fn(async () => {}) });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.id).toEqual(expect.any(String));
        expect(createdValue.id).not.toBe(LEGACY_ID);
    });

    it('replaces request-body ids that collide with an existing client', async () => {
        let createdValue;
        const controller = instantiateController({
            body: validClientPayload({ id: COLLIDING_ID }),
            permissions: grantCreate(),
        });
        controller.repository.find = jest.fn(async () => ({ id: { value: COLLIDING_ID } }));
        controller.clientCreatorFactory = () => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
            }),
        });
        controller.fakeClientCreatorFactory = () => ({ execute: jest.fn(async () => {}) });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.id).toEqual(expect.any(String));
        expect(createdValue.id).not.toBe(COLLIDING_ID);
        expect(controller.repository.find).not.toHaveBeenCalled();
    });

    it('replaces malformed request-body ids before persistence', async () => {
        let createdValue;
        const controller = instantiateController({
            body: validClientPayload({ id: 'not-a-uuid' }),
            permissions: grantCreate(),
        });
        controller.clientCreatorFactory = () => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
            }),
        });
        controller.fakeClientCreatorFactory = () => ({ execute: jest.fn(async () => {}) });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.id).toEqual(expect.any(String));
        expect(createdValue.id).not.toBe('not-a-uuid');
        expect(controller.repository.findByIdentification).toHaveBeenCalled();
    });

    it('overrides caller-controlled audit fields on create', async () => {
        let createdValue;
        const controller = instantiateController({
            body: validClientPayload({
                created_by: '99999999-9999-4999-8999-999999999999',
                created_at: '2000-01-01T00:00:00.000Z',
            }),
            permissions: grantCreate(),
        });
        controller.clientCreatorFactory = () => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
            }),
        });
        controller.fakeClientCreatorFactory = () => ({ execute: jest.fn(async () => {}) });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.created_by).toBe(controller.user.id.value);
        expect(createdValue.created_at).not.toBe('2000-01-01T00:00:00.000Z');
    });

    it('overrides caller-controlled audit fields on update', async () => {
        let updatedValue;
        const controller = instantiateController({
            body: validClientPayload({
                updated_by: '99999999-9999-4999-8999-999999999999',
                updated_at: '2000-01-01T00:00:00.000Z',
            }),
            pathParameters: { id: EXISTING_ID },
            permissions: grantAdminUpdate(),
        });
        controller.clientUpdaterFactory = () => ({
            execute: jest.fn(async (_id, value) => {
                updatedValue = value;
            }),
        });

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBe(200);
        expect(updatedValue.updated_by).toBe(controller.user.id.value);
        expect(updatedValue.updated_at).not.toBe('2000-01-01T00:00:00.000Z');
    });

    it('overrides caller-controlled audit fields on delete', async () => {
        let deletedDto;
        const controller = instantiateController({
            body: {
                deleted_by: '99999999-9999-4999-8999-999999999999',
                deleted_at: '2000-01-01T00:00:00.000Z',
            },
            pathParameters: { id: EXISTING_ID },
            permissions: grantAdminDelete(),
        });
        controller.clientDeleterFactory = () => ({
            execute: jest.fn(async (_id, dto) => {
                deletedDto = dto;
            }),
        });

        const response = await controller.actionDelete();

        expect(response.statusCode).toBe(200);
        expect(deletedDto.deleted_by).toBe(controller.user.id.value);
        expect(deletedDto.deleted_at).not.toBe('2000-01-01T00:00:00.000Z');
    });
});
