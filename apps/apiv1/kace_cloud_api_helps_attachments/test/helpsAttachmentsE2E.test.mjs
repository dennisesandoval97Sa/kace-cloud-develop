import { KnexHelpsAttachmentsRepository } from '@kace/core/src/helps_attachments';
import { production as knexConfig } from '@kace/database/knexfile';
import { HelpsAttachmentsFactory } from '@kace/core/src/factories/HelpsAttachmentsFactory';
import HelpsAttachmentsMother from '@kace/core/tests/helps_attachments/domain/HelpsAttachmentsMother.js';
import { TestHelper } from '@kace/api-common';

describe('HelpsAttachmentsController test', () => {
    const repository = new KnexHelpsAttachmentsRepository(knexConfig);
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/helps-attachments`
            : 'http://127.0.0.1:60031';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a help attachment record', async () => {
        const payload = await HelpsAttachmentsFactory.generateAttributes();
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
    });

    it('should fetch all help attachments records', async () => {
        const helpAttachment1 = await HelpsAttachmentsMother.createHelpAttachment(repository);
        const helpAttachment2 = await HelpsAttachmentsMother.createHelpAttachment(repository);
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(helpAttachment2.id.value);
        expect(response.data.data.items[1].id).toEqual(helpAttachment1.id.value);
    });

    it('should fetch a specific help attachment record by ID', async () => {
        const helpAttachment = await HelpsAttachmentsFactory.create();
        const dataExpected = {
            id: helpAttachment.id.value,
            path: helpAttachment.path.value,
            tipo: helpAttachment.tipo.value,
            help_id: helpAttachment.help_id.value,
            created_at: helpAttachment.created_at.value,
            created_by: helpAttachment.created_by.value,
            updated_by: null,
            updated_at: null,
        };
        const response = await TestHelper.getRequest(`${baseUrl}/${helpAttachment.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should delete a help attachment record by ID', async () => {
        const helpAttachment = await HelpsAttachmentsMother.createHelpAttachment(repository);
        const response = await TestHelper.getRequest(`${baseUrl}/${helpAttachment.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should fetch help attachment records using search criteria', async () => {
        const helpAttachment = await HelpsAttachmentsMother.createHelpAttachment(repository);
        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: helpAttachment.id.value,
                    type: 'AND',
                },
            ],
            limit: 10,
            offset: 0,
        };
        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
    });
});
