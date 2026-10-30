import { TestHelper } from '@kace/api-common';

describe('States all to cases', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/states-distinct`
            : `http://localhost:60044`;

    test('should return the unique values of all states', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}`);
        expect(response.status).toBe(200);
    });
});
