import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

const CLIENT_SENT_ID = '55555555-5555-4555-8555-555555555555';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validTemplatePayload = (overrides = {}) => ({
    tipo: 1,
    descripcion: 'Security regression template',
    destinatario: 'correo@test.com',
    copia: null,
    copia_oculta: null,
    asunto: 'Security regression subject',
    cuerpo: 'Security regression body',
    ruta: null,
    incluye_adjuntos: true,
    enviar_adjuntos_del_caso: false,
    status: 1,
    ...overrides,
});

const instantiateController = ({ body } = {}) => {
    const controller = new Controller(createApiEvent({ body }), knexConfig);
    controller.user = createAuthenticatedUser({
        permissions: {
            administrador: [permission('administrador', 'templates', 'TemplatesCreate')],
        },
    });
    controller.started_at = new Date('2026-07-08T12:00:00.000Z');
    controller.repository = {
        tableName: 'plantillas',
        find: jest.fn(async () => null),
        search: jest.fn(async () => []),
        save: jest.fn(async () => {}),
        saveHistory: jest.fn(async () => {}),
    };
    return controller;
};

describe('Templates object identity authorization', () => {
    it('replaces a client-supplied id with a server-generated one and returns it', async () => {
        const controller = instantiateController({
            body: validTemplatePayload({ id: CLIENT_SENT_ID }),
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(response.data.id).toMatch(UUID_PATTERN);
        expect(response.data.id).not.toBe(CLIENT_SENT_ID);

        const savedTemplate = controller.repository.save.mock.calls[0][0];
        expect(savedTemplate.id.value).toBe(response.data.id);
    });

    it('generates and returns an id when the request body has none', async () => {
        const controller = instantiateController({
            body: validTemplatePayload(),
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(response.data.id).toMatch(UUID_PATTERN);

        const savedTemplate = controller.repository.save.mock.calls[0][0];
        expect(savedTemplate.id.value).toBe(response.data.id);
    });
});
