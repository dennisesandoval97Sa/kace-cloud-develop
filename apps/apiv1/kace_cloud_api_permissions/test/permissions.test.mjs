import { TestHelper } from '@kace/api-common';

describe('Permissions', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/permissions`
            : 'http://localhost:60054';

    beforeEach(async () => {
        await TestHelper.resetSchemaAndMigrate();
    });

    it('should return a permissions list', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}`);
        const data = response.data.data;

        expect(data).toHaveProperty('agente');
        expect(data).toHaveProperty('administrador');
    });
});
