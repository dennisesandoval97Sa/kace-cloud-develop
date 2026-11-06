import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';

import { Controller } from '../src/controller.mjs';

const LINK_ID = '55555555-5555-4555-8555-555555555555';

const validLink = {
    title: 'Documentación KACE',
    url: 'https://example.com',
    position: 0,
};

const createController = ({ body, permissions } = {}) => {
    const event = createApiEvent({
        body: body ?? validLink,
    });

    const controller = new Controller(event, knexConfig);

    controller.user = createAuthenticatedUser({
        permissions: permissions ?? {
            administrador: [
                permission('administrador', 'quick_links', 'QuickLinksRead'),
                permission('administrador', 'quick_links', 'QuickLinksCreate'),
                permission('administrador', 'quick_links', 'QuickLinksDelete'),
            ],
        },
    });

    controller.repository = {
        findAll: jest.fn().mockResolvedValue([]),
        find: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue(),
        nextPosition: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue(),
        destroyConnection: jest.fn().mockResolvedValue(),
    };

    return controller;
};

describe('Quick Links Controller', () => {
    it('retorna 403 si no tiene permiso de lectura', async () => {
        const controller = createController({
            permissions: { administrador: [] },
        });

        const response = await controller.actionIndex();

        expect(response.statusCode).toBe(403);
        expect(controller.repository.findAll).not.toHaveBeenCalled();
    });

    it('retorna 403 si no tiene permiso de creación', async () => {
        const controller = createController({
            permissions: { administrador: [] },
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(403);
        expect(controller.repository.save).not.toHaveBeenCalled();
    });

    it('retorna 400 si la URL es inválida', async () => {
        const controller = createController({
            body: {
                title: 'Enlace inseguro',
                url: 'javascript:alert(1)',
            },
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(400);
        expect(controller.repository.save).not.toHaveBeenCalled();
    });

    it('retorna 400 si el título está vacío', async () => {
        const controller = createController({
            body: {
                title: '',
                url: 'https://example.com',
            },
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(400);
        expect(controller.repository.save).not.toHaveBeenCalled();
    });

    it('retorna 200 al listar enlaces', async () => {
        const controller = createController();

        const response = await controller.actionIndex();

        expect(response.statusCode).toBe(200);
        expect(controller.repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('retorna 403 si no tiene permiso de eliminación', async () => {
        const controller = createController({
            permissions: { administrador: [] },
        });

        const response = await controller.actionDelete();

        expect(response.statusCode).toBe(403);
        expect(controller.repository.find).not.toHaveBeenCalled();
    });

    it('retorna 404 si intenta eliminar un enlace inexistente', async () => {
        const controller = createController();

        controller.pathParameters = () => ({ id: LINK_ID });

        const response = await controller.actionDelete();

        expect(response.statusCode).toBe(404);
        expect(controller.repository.find).toHaveBeenCalled();
        expect(controller.repository.delete).not.toHaveBeenCalled();
    });

    it('retorna 201 al crear un enlace válido', async () => {
        const controller = createController();

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(controller.repository.save).toHaveBeenCalledTimes(1);
    });

    it('retorna 200 al eliminar un enlace existente', async () => {
        const controller = createController();
        controller.pathParameters = () => ({ id: LINK_ID });
        const existingLink = {
            id: { value: LINK_ID },
            delete: jest.fn(),
            changedAttributes: { deleted_at: new Date().toISOString() },
        };
        controller.repository.find.mockResolvedValue(existingLink);

        const response = await controller.actionDelete();

        expect(response.statusCode).toBe(200);
        expect(existingLink.delete).toHaveBeenCalledTimes(1);
        expect(controller.repository.delete).toHaveBeenCalledTimes(1);
    });
});
