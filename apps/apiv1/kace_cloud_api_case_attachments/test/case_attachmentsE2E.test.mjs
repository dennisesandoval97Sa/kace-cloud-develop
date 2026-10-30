import { v4 as uuidv4 } from 'uuid';
import CaseAttachmentsMother from '@kace/core/tests/case-attachments/domain/CaseAttachmentMother.js';
import { TestHelper } from '@kace/api-common';
import { production as knexConfig } from '@kace/database/knexfile';
import { KnexCaseAttachmentRepository } from '@kace/core/src/case-attachments';
import { Helper } from '@kace/core/src/shared/index.js';

describe('CaseAttachmentsController test', () => {
    const repository = new KnexCaseAttachmentRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-attachments`
            : `http://127.0.0.1:60009`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a CaseAttachment record', async () => {
        const payload = CaseAttachmentsMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create a CaseAttachment record', async () => {
        const payload = {};

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch a CaseAttachment record', async () => {
        const caseAttachment = await CaseAttachmentsMother.create(repository);
        const dataExpected = {
            id: caseAttachment.id.value,
            size: caseAttachment.size.value,
            path: caseAttachment.path.value,
            type: caseAttachment.type.value,
            created_by: caseAttachment.created_by.value,
            created_at: caseAttachment.created_at.value,
            updated_by: null,
            updated_at: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${caseAttachment.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data.id).toBe(dataExpected.id);
    });

    it('should fetch all CaseAttachment records', async () => {
        const caseAttachment1 = await CaseAttachmentsMother.create(repository);
        const caseAttachment2 = await CaseAttachmentsMother.create(repository);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(caseAttachment2.id.value);
        expect(response.data.data.items[1].id).toEqual(caseAttachment1.id.value);
    });

    it('should delete a CaseAttachment record', async () => {
        const caseAttachment = await CaseAttachmentsMother.create(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${caseAttachment.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a CaseAttachment record', async () => {
        const caseAttachment = await CaseAttachmentsMother.create(repository);
        const payload = {
            path: '/updated/path/file.png',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${caseAttachment.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return an empty object when fetching a deleted CaseAttachment record', async () => {
        const caseAttachment = await CaseAttachmentsMother.create(repository);

        await TestHelper.getRequest(`${baseUrl}/${caseAttachment.id.value}/delete`);

        const response = await TestHelper.getRequest(`${baseUrl}/${caseAttachment.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return an empty object when fetching a non-existent CaseAttachment record', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
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
