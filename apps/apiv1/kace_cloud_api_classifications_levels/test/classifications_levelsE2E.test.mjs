import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { ClassificationFactory } from '@kace/core/src/factories/ClassificationFactory.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications/index.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('Classifications Levels', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/classifications-levels`
            : 'http://127.0.0.1:60016';

    const repository = new KnexClassificationRepository(knexConfig);

    beforeEach(async () => {
        try {
            await repository.connection.raw(`TRUNCATE TABLE ${repository.tableName} CASCADE`);
        } catch (e) {
            Helper.logInfo(e);
        }
    });

    test('should return the unique values of the requested level', async () => {
        const values = ['Colombia', 'Peru', 'Chile'];
        for (const value of values) {
            await ClassificationFactory.create({ nivel1: value });
        }

        const response = await TestHelper.getRequest(`${baseUrl}/nivel1`);

        expect(response.status).toBe(200);
        for (const value of values) {
            expect(response.data.data.items).toContain(value);
        }
    });
});
