import { v4 as uuidv4 } from 'uuid';
import { TestHelper } from '@kace/api-common';
import { production as knexConfig } from '@kace/database/knexfile';
import { KnexGlobalConfigurationRepository } from '@kace/core/src/global-config/index.js';
import { GlobalConfigurationsMother } from '@kace/core/tests/global-config/domain/GlobalConfigurationsMother.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('GlobalConfigurationsE2E test', () => {
    const repository = new KnexGlobalConfigurationRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/global-configuration-get`
            : `http://127.0.0.1:60037`;

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should return notFound when the resource doesnt exist', async () => {
        let response;
        try {
            response = await TestHelper.postRequest(`${baseUrl}/invalid`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should set configuration settings correctly', async () => {
        const globalConfig = await GlobalConfigurationsMother.createConfiguration(repository);

        const payload = {
            type: 'layouts',
            application: 'agente',
            module: 'headerSection',
            someSetting: 'newValue',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${globalConfig.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return an error when fetching a non-existent configuration', async () => {
        try {
            await TestHelper.postRequest(`${baseUrl}/${uuidv4()}`);
        } catch (error) {
            expect(error.response.status).toBe(404);
            expect(error.response.data.message).toContain('does not exist');
        }
    });
});
