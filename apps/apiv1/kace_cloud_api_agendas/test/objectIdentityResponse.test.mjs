import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import { createApiEvent, createAuthenticatedUser } from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

describe('Agenda object identity response', () => {
    it('returns the canonical persisted id when replacing a request-body id on create', async () => {
        const requestBodyId = '11111111-1111-4111-8111-111111111111';
        const savedAgendas = [];
        const event = createApiEvent({
            body: {
                id: requestBodyId,
                description: 'Agenda with untrusted id',
                daily_limit: 5,
                is_active: true,
                is_for_weekend: false,
                one_script_id: '',
            },
        });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [
                    {
                        module_id: 'agendas',
                        name: 'AgendasCreate',
                        granted: true,
                    },
                ],
            },
        });
        controller.repository = {
            find: jest.fn().mockResolvedValue(null),
            save: jest.fn(async (agenda) => {
                savedAgendas.push(agenda);
            }),
        };

        const response = await controller.actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(201);
        expect(savedAgendas).toHaveLength(1);
        expect(savedAgendas[0].id.value).not.toBe(requestBodyId);
        expect(body.data.id).toBe(savedAgendas[0].id.value);
    });
});
