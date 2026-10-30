import { KnexTemplateAttachmentRepository } from '@kace/core/src/template-attachments';
import TemplateAttachmentMother from '@kace/core/tests/template-attachments/domain/TemplateAttachmentMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { SQL_BLACKLIST_WORD_DETECTED } from '@kace/error-codes';

describe('TemplateAttachmentsController test', () => {
    const repository = new KnexTemplateAttachmentRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/template-attachments`
            : 'http://127.0.0.1:60045';

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a TemplateAttachment record', async () => {
        const payload = TemplateAttachmentMother.dto();

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Template', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('returns a public error code when attachment path contains SQL blacklist words', async () => {
        const payload = TemplateAttachmentMother.dto({
            path: "invoice'; SELECT FROM users; --.pdf",
            type: 'application/pdf',
        });

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response).toHaveProperty('status', 400);
        expect(response.data.data.code).toBe(SQL_BLACKLIST_WORD_DETECTED);
    });

    it('should fetch a TemplateAttachment record', async () => {
        const templateAttachment = await TemplateAttachmentMother.create(repository);
        const dataExpected = {
            id: templateAttachment.id.value,
            path: templateAttachment.path.value,
            type: templateAttachment.type.value,
            created_by: templateAttachment.created_by.value,
            created_at: templateAttachment.created_at.value,
            updated_by: null,
            updated_at: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${templateAttachment.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data.id).toBe(dataExpected.id);
    });

    it('should fetch templates attachments using search', async () => {
        const created = await TemplateAttachmentMother.create(repository);
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

    it('should update a TemplateAttachment record', async () => {
        const templateAttachment = await TemplateAttachmentMother.create(repository);
        const payload = {
            path: 'file.png',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${templateAttachment.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should delete a TemplateAttachment record', async () => {
        const templateAttachment = await TemplateAttachmentMother.create(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${templateAttachment.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should return an empty object when fetching a deleted TemplateAttachment record', async () => {
        const templateAttachment = await TemplateAttachmentMother.create(repository);

        await TestHelper.getRequest(`${baseUrl}/${templateAttachment.id.value}/delete`);

        const response = await TestHelper.getRequest(`${baseUrl}/${templateAttachment.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return an empty object when fetching a non-existent TemplateAttachment record', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
