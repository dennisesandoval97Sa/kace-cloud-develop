import { HttpResponse } from '@kace/api-common';
import { createApiEvent, createAuthenticatedUser } from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { CustomController } from '../src/customController.mjs';

const createFakeKnex = () => {
    const knex = () => {
        throw new Error('Fake knex should not be queried in this test');
    };
    return knex;
};

describe('AgendasGroups CustomController run', () => {
    it('waits for the selected action before destroying the repository connection', async () => {
        const order = [];
        const event = createApiEvent({
            resource: '/batch',
            httpMethod: 'POST',
            body: [],
        });
        const controller = new CustomController(event, createFakeKnex());
        controller.getLoggedInUser = async () => createAuthenticatedUser();
        controller.repository = {
            destroyConnection: async () => {
                order.push('destroy');
            },
        };
        controller.actionCreateBatch = async () => {
            order.push('action:start');
            await new Promise((resolve) => setTimeout(resolve, 0));
            order.push('action:end');
            return HttpResponse.created({ event });
        };

        const response = await controller.run();

        expect(response.statusCode).toBe(201);
        expect(order).toEqual(['action:start', 'action:end', 'destroy']);
    });
});
