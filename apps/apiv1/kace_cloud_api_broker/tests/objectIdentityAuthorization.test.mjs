import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

describe('Broker adapter object identity authorization', () => {
    it('replaces request-body adapter ids and overwrites create audit fields before persistence', async () => {
        const requestId = '44444444-4444-4444-8444-444444444444';
        const event = createApiEvent({
            body: {
                id: requestId,
                name: 'Support queue',
                host: 'rabbitmq.local',
                port: 5672,
                queue: 'support',
                vhost: '/',
                username: 'agent',
                password: 'secret',
                created_by: '99999999-9999-4999-8999-999999999999',
                created_at: '2000-01-01T00:00:00.000Z',
            },
        });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [permission('administrador', 'broker_adapters', 'BrokerAdaptersCreate')],
            },
        });
        controller.started_at = new Date('2026-04-23T12:00:00.000Z');
        let createdValue;
        controller.adapterRepositoryFactory = jest.fn(() => ({}));
        controller.adapterCreatorFactory = jest.fn(() => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
            }),
        }));

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.id).toEqual(expect.any(String));
        expect(createdValue.id).not.toBe(requestId);
        expect(createdValue.created_by).toBe(controller.user.id.value);
        expect(createdValue.created_at).not.toBe('2000-01-01T00:00:00.000Z');
    });
});
