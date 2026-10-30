import { KnexWSRestEndpointRepository } from '@kace/core/src/ws-rest-endpoints';
import WSRestEndpointMother from '@kace/core/tests/ws-rest-endpoints/domain/WSRestEndpointMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('WSRestEndpointController test', () => {
    const repository = new KnexWSRestEndpointRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/broker`
            : `http://127.0.0.1:60052`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a WSRestEndpoint', async () => {
        const payload = WSRestEndpointMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });
});
