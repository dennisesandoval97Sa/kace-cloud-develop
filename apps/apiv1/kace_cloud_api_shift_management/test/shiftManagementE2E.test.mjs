import { KnexShiftManagementRepository } from '@kace/core/src/shift-management';
import ShiftManagementMother from '@kace/core/tests/shift-management/domain/ShiftManagementMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { beforeEach } from 'node:test';

describe('ActionUpdateModelController test', () => {
    const repository = new KnexShiftManagementRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/shift-management`
            : 'http://127.0.0.1:60042';

    beforeEach(async () => {
        try {
            await TestHelper.resetSchemaAndMigrate();
        } catch (error) {
            console.log(error);
        }
    });

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a ShiftManagement record', async () => {
        const payload = ShiftManagementMother.dto();

        await repository.connection(repository.tableName).delete().where({ description: payload.description });

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Template', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a ShiftManagement record', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);
        const dataExpected = {
            id: shiftManagement.id.value,
            description: shiftManagement.description.value,
            holiday_dates: shiftManagement.holiday_dates.value,
            work_days: shiftManagement.work_days.value,
            created_by: shiftManagement.created_by.value,
            created_at: shiftManagement.created_at.value,
            updated_by: null,
            updated_at: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${shiftManagement.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch templates attachments using search', async () => {
        const created = await ShiftManagementMother.createShiftManagement(repository);
        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: created.id.value,
                    type: 'AND',
                },
            ],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
        expect(response.data.data.items[0].id).toEqual(created.id.value);
    });
    it('should update a ShiftManagement record', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);
        const payload = {
            description: 'Updated description',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${shiftManagement.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should delete a ShiftManagement record', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${shiftManagement.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should return an empty object when fetching a deleted ShiftManagement record', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);

        await TestHelper.getRequest(`${baseUrl}/${shiftManagement.id.value}/delete`);

        const response = await TestHelper.getRequest(`${baseUrl}/${shiftManagement.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return an empty object when fetching a non-existent ShiftManagement record', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
