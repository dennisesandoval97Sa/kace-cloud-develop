import { v4 as uuidv4 } from 'uuid';
import { KnexCaseDescriptionRepository } from '@kace/core/src/case-descriptions';
import { production as knexConfig } from '@kace/database/knexfile';
import CaseDescriptionsMother from '@kace/core/tests/case-descriptions/domain/CaseDescriptionsMother.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

describe('CaseDescriptionsController test', () => {
    const repository = new KnexCaseDescriptionRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-descriptions`
            : `http://127.0.0.1:60013`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a CaseDescription record', async () => {
        const payload = CaseDescriptionsMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create a CaseDescription record', async () => {
        const payload = {};
        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }
        expect(response.status).toBe(400);
    });

    it('should fetch a CaseDescription record', async () => {
        const caseDescription = await CaseDescriptionsMother.createCaseDescription(repository);
        const dataExpected = {
            id: caseDescription.id.value,
            descripcion: caseDescription.descripcion.value,
            created_by: caseDescription.created_by.value,
            created_at: caseDescription.created_at.value,
            updated_by: null,
            updated_at: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${caseDescription.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data.id).toBe(dataExpected.id);
    });

    it('should fetch all CaseDescription records', async () => {
        const caseDescription1 = await CaseDescriptionsMother.createCaseDescription(repository);
        const caseDescription2 = await CaseDescriptionsMother.createCaseDescription(repository);

        const response1 = await TestHelper.getRequest(`${baseUrl}/${caseDescription1.id.value}`);
        const response2 = await TestHelper.getRequest(`${baseUrl}/${caseDescription2.id.value}`);

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
        expect(response1.data.data.id).toEqual(caseDescription1.id.value);
        expect(response2.data.data.id).toEqual(caseDescription2.id.value);
    });

    it('should update a CaseDescription record', async () => {
        const caseDescription = await CaseDescriptionsMother.createCaseDescription(repository);
        const payload = {
            descripcion: 'Updated description',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${caseDescription.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when fetching a non-existent CaseDescription record', async () => {
        const nonExistentId = uuidv4();

        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/${nonExistentId}`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(500);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/invalid`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });
});
