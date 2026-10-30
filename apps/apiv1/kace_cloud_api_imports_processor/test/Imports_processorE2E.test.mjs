import { TestHelper } from '@kace/api-common';

describe('field-listE2E test', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/imports-processor`
            : 'http://localhost:60091';

    it('should fetch all Groups', async () => {
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
    });
});
