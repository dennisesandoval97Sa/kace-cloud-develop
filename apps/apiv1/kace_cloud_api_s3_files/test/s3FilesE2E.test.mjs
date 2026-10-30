import { KnexS3FileRepository } from '@kace/core/src/s3-files';
import S3FileMother from '@kace/core/tests/s3-files/domain/S3FileMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('S3FilesController test', () => {
    const repository = new KnexS3FileRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/s3-files`
            : 'http://127.0.0.1:60040';

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create an S3File', async () => {
        const payload = S3FileMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Template', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch an S3File', async () => {
        const s3File = await S3FileMother.createS3File(repository);
        const dataExpected = {
            id: s3File.id.value,
            description: s3File.description.value,
            file_name: s3File.file_name.value,
            s3_file_name: s3File.s3_file_name.value,
            url: s3File.url.value,
            size: s3File.size.value,
            origin: s3File.origin.value,
            expired_at: s3File.expired_at.value,
            is_active: s3File.is_active.value,
            created_at: s3File.created_at.value,
            updated_at: null,
            created_by: s3File.created_by.value,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${s3File.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch actions using search', async () => {
        const created = await S3FileMother.createS3File(repository);
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

    it('should update an S3File', async () => {
        const s3File = await S3FileMother.createS3File(repository);
        const payload = {
            description: 'Updated Description',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${s3File.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should delete an S3File', async () => {
        const s3File = await S3FileMother.createS3File(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${s3File.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
