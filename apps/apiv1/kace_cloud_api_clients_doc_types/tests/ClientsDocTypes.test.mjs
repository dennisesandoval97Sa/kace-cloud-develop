import { KnexClientRepository } from '@kace/core/src/clients';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

describe('ClientController test', () => {
    const repository = new KnexClientRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/clients_doc_types`
            : 'http://127.0.0.1:60056';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should return all the doctypes', async () => {
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);

        const dataKeys = Object.keys(response.data.data);
        expect(dataKeys.length).toBeGreaterThan(0);

        const dynamicField = response.data.data[dataKeys[0]];
        expect(Array.isArray(dynamicField)).toBe(true);
    });
});
