import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import HelpsAttachmentsMother from '@kace/core/tests/helps_attachments/domain/HelpsAttachmentsMother.js';
import { Controller } from '../src/Controller.mjs';

const existingHelpQuery = (helpId) => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    modify: jest.fn(function modify(callback) {
        callback(this);
        return this;
    }),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(async () => ({ id: helpId })),
});

describe('Help Attachment create response', () => {
    it('returns the server-generated id persisted for a create request without an id', async () => {
        const payload = HelpsAttachmentsMother.dto();
        delete payload.id;

        const controller = new Controller(createApiEvent({ body: payload }), knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [permission('administrador', 'help-attachments', 'HelpAttachmentsCreate')],
            },
        });
        controller.getGlobalConfig = jest.fn(async () => ({
            toJson: () => ({
                settings: {
                    behaviors: {
                        application: {
                            agente: {
                                files_extensions: {
                                    allowed_file_extensions: ['.png'],
                                },
                            },
                        },
                    },
                },
            }),
        }));

        const savedAttachments = [];
        controller.repository = {
            table: jest.fn(() => existingHelpQuery(payload.help_id)),
            find: jest.fn(async () => null),
            save: jest.fn(async (attachment) => {
                savedAttachments.push(attachment);
            }),
            saveHistory: jest.fn(async () => {}),
        };

        const response = await controller.actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(201);
        expect(savedAttachments).toHaveLength(1);
        expect(body.data.id).toBe(savedAttachments[0].id.value);
    });

    it('returns a safe filename rejection code without persisting an unsafe path', async () => {
        const payload = {
            ...HelpsAttachmentsMother.dto(),
            path: 'select report.pdf',
        };
        delete payload.id;

        const controller = new Controller(createApiEvent({ body: payload }), knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [permission('administrador', 'help-attachments', 'HelpAttachmentsCreate')],
            },
        });
        controller.getGlobalConfig = jest.fn(async () => ({
            toJson: () => ({
                settings: {
                    behaviors: {
                        application: {
                            agente: {
                                files_extensions: {
                                    allowed_file_extensions: ['.pdf'],
                                },
                            },
                        },
                    },
                },
            }),
        }));

        const save = jest.fn(async () => {});
        controller.repository = {
            table: jest.fn(() => existingHelpQuery(payload.help_id)),
            find: jest.fn(async () => null),
            save,
            saveHistory: jest.fn(async () => {}),
        };

        const response = await controller.actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe('0x120001');
        expect(body.message).not.toContain(payload.path);
        expect(save).not.toHaveBeenCalled();
    });

    it('maps filename pattern validation failures to the public rejection code', async () => {
        const payload = {
            ...HelpsAttachmentsMother.dto(),
            path: 'report.p',
        };
        delete payload.id;

        const controller = new Controller(createApiEvent({ body: payload }), knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [permission('administrador', 'help-attachments', 'HelpAttachmentsCreate')],
            },
        });
        controller.getGlobalConfig = jest.fn(async () => ({
            toJson: () => ({
                settings: {
                    behaviors: {
                        application: {
                            agente: {
                                files_extensions: {
                                    allowed_file_extensions: ['.p'],
                                },
                            },
                        },
                    },
                },
            }),
        }));

        const save = jest.fn(async () => {});
        controller.repository = {
            table: jest.fn(() => existingHelpQuery(payload.help_id)),
            find: jest.fn(async () => null),
            save,
            saveHistory: jest.fn(async () => {}),
        };

        const response = await controller.actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe('0x120001');
        expect(body.message).not.toContain(payload.path);
        expect(save).not.toHaveBeenCalled();
    });
});
