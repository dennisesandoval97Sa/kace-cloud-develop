import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import { createApiEvent, createAuthenticatedUser } from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

describe('Broker mapper object identity authorization', () => {
    it('uses a server-generated canonical ID instead of trusting request-body id on create', async () => {
        const requestBodyId = '77777777-7777-4777-8777-777777777777';
        const created = [];
        const event = createApiEvent({
            body: {
                id: requestBodyId,
                name: 'mapper from untrusted payload',
                rest_flow_id: '88888888-8888-4888-8888-888888888888',
                rules: [],
            },
        });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [
                    {
                        module_id: 'broker_mappers',
                        name: 'BrokerMappersCreate',
                        granted: true,
                    },
                ],
            },
        });
        controller.repository = {
            findById: jest.fn().mockResolvedValue(null),
            findByName: jest.fn().mockResolvedValue(null),
            create: jest.fn(async (dto) => {
                created.push(dto);
                return dto;
            }),
        };

        const response = await controller.actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(201);
        expect(created).toHaveLength(1);
        expect(created[0].id).not.toBe(requestBodyId);
        expect(body.data.id).toBe(created[0].id);
    });
});
