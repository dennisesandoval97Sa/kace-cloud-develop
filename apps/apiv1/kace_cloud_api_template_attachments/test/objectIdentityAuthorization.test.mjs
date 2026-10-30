import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

const CLIENT_SENT_ID = '55555555-5555-4555-8555-555555555555';
const TEMPLATE_ID = '66666666-6666-4666-8666-666666666666';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validAttachmentPayload = (overrides = {}) => ({
    template_id: TEMPLATE_ID,
    path: 'manual.pdf',
    type: 'application/pdf',
    is_active: true,
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
            administrador: [permission('administrador', 'template-attachments', 'TemplateAttachmentsCreate')],
        },
    });
    controller.started_at = new Date('2026-07-08T12:00:00.000Z');
    controller.repository = {
        table: createRelationshipConnection({ missingTables }),
        find: jest.fn(async () => null),
        save: jest.fn(async () => {}),
        saveHistory: jest.fn(async () => {}),
    };
    controller.getGlobalConfig = jest.fn(async () => ({
        toJson: () => ({
            settings: {
                behaviors: {
                    application: {
                        agente: {
                            files_extensions: {
                                allowed_file_extensions: ['.pdf', '.png'],
                            },
                        },
                    },
                },
            },
        }),
    }));
    return controller;
};

describe('Template attachments object identity authorization', () => {
    it('rejects template_id references that do not exist (strict, no draft carve-out)', async () => {
        const controller = instantiateController({
            body: validAttachmentPayload({ id: CLIENT_SENT_ID }),
            missingTables: ['plantillas'],
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(404);
        expect(controller.repository.save).not.toHaveBeenCalled();
    });

    it('replaces a client-supplied id and returns the created record', async () => {
        const controller = instantiateController({
            body: validAttachmentPayload({ id: CLIENT_SENT_ID }),
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(response.data.id).toMatch(UUID_PATTERN);
        expect(response.data.id).not.toBe(CLIENT_SENT_ID);
        expect(response.data.template_id).toBe(TEMPLATE_ID);
        expect(response.data.path).toBe('manual.pdf');
        expect(response.data.type).toBe('application/pdf');

        const savedAttachment = controller.repository.save.mock.calls[0][0];
        expect(savedAttachment.id.value).toBe(response.data.id);
    });

    it('generates and returns an id when the request body has none', async () => {
        const controller = instantiateController({
            body: validAttachmentPayload(),
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(response.data.id).toMatch(UUID_PATTERN);
        expect(response.data.template_id).toBe(TEMPLATE_ID);
    });
});
