import { production as knexConfig } from '@kace/database/knexfile';
import { KnexFieldListRepository } from '@kace/core/src/field-list/index.js';
import { TestHelper } from '@kace/api-common';

describe('field-listE2E test', () => {
    const repositorio = new KnexFieldListRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/schema-fields`
            : 'http://localhost:60024';

    it('should return an array with values', async () => {
        const tableName = await repositorio.getRandomTableName();

        const response = await TestHelper.getRequest(`${baseUrl}/${tableName[0].table_name}`);

        const fieldList = response.data.data.items;
        expect(fieldList.length).toBeGreaterThan(0);
    });

    it('should return an array of items definitions with correct structure', async () => {
        const tableName = await repositorio.getRandomTableName();

        const response = await TestHelper.getRequest(`${baseUrl}/${tableName[0].table_name}`);
        const fieldList = response.data.data.items;

        fieldList.forEach((item) => {
            expect(item).toHaveProperty('column_name');
            expect(item).toHaveProperty('data_type');
            expect(item).toHaveProperty('character_maximum_length');
            expect(item).toHaveProperty('relation');
            expect(item).toHaveProperty('label');
        });
    });

    it('There should not be two elements with the same column_name', async () => {
        const tableName = await repositorio.getRandomTableName();

        const response = await TestHelper.getRequest(`${baseUrl}/${tableName[0].table_name}`);
        const fieldList = response.data.data.items;

        const uniqueObjects = new Set(fieldList.map((item) => JSON.stringify(item)));

        expect(uniqueObjects.size).toBe(fieldList.length);
    });
});
