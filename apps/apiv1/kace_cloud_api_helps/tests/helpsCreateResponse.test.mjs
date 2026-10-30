import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import HelpsMother from '@kace/core/tests/helps/domain/HelpsMother';
import { Controller } from '../src/Controller.mjs';

describe('Help create response', () => {
    it('returns the server-generated id persisted for a create request without an id', async () => {
        const payload = HelpsMother.dto();
        delete payload.id;

        const controller = new Controller(createApiEvent({ body: payload }), knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [permission('administrador', 'help', 'HelpsCreate')],
            },
        });

        const savedHelps = [];
        controller.repository = {
            tableName: 'helps',
            find: jest.fn(async () => null),
            search: jest.fn(async () => []),
            save: jest.fn(async (help) => {
                savedHelps.push(help);
            }),
            saveHistory: jest.fn(async () => {}),
        };

        const response = await controller.actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(201);
        expect(savedHelps).toHaveLength(1);
        expect(body.data.id).toBe(savedHelps[0].id.value);
    });
});
