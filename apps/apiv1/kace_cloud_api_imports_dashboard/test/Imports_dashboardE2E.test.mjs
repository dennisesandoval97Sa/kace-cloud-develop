import { TestHelper } from '@kace/api-common';
import { S3FileImport } from '@kace/core/src/imports/application/import/S3FileImport';
import { KnexS3ImportFiles } from '@kace/core/src/imports/infrastructure/persistence/KnexS3ImportFiles';
import { production as knexConfig } from '@kace/database/knexfile';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('field-listE2E test', () => {
    const validDto = {
        id: uuidv4(),
        file_path: 'folder/test.csv',
        status: 'pending',
        upload_attempts: 0,
        total_records: 10,
        processed_records: 0,
        last_updated_at: new Date(),
        created_at: new Date(),
        created_by: 'a57ed068-e85a-42ac-b4bd-a6dd46283073',
        error_details: null,
        target_table: 'usuarios',
    };

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/imports`
            : 'http://localhost:60092';

    it('Register an import file', async () => {
        const registerService = new S3FileImport(new KnexS3ImportFiles(knexConfig));

        await registerService.execute(validDto);

        const response = await TestHelper.getRequest(`${baseUrl}/${validDto.created_by}`);

        expect(response).toHaveProperty('status', 200);
    });

    it('return statusCode 400 when id is invalid', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/invalid_id`);
        expect(response).toHaveProperty('status', 400);
    });
});
