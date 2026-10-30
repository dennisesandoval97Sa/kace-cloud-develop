import { knexConfig } from '../knexfile';
import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles';
import { S3ImportFile } from '../../src/imports/domain/S3ImportFile.js';
import { S3ImportsDashboard } from '../../src/imports/application/imports-dashboard/S3ImportsDashboard.js';

const validDto = {
    id: 'a57ed068-e85a-42ac-b4bd-a6dd46283073',
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

describe('S3ImportsDashboard - Integration Test', () => {
    const repository = new KnexS3ImportFiles(knexConfig);
    const service = new S3ImportsDashboard(repository);

    it('should return all imports for a given user', async () => {
        const aggregate = S3ImportFile.create(validDto);
        await repository.save(aggregate);

        const result = await service.execute(validDto.created_by);
        const response = result.toJson();

        expect(response.data.items.length).toBeGreaterThanOrEqual(1);
        expect(response.data.items[0].id).toBe(validDto.id);
        expect(response.data.items[0].target_table).toBe(validDto.target_table);
    });

    it('should return an empty array if user has no imports', async () => {
        // `created_by` es `uuid` en postgres: buscar por una cadena que no lo
        // sea aborta la consulta en vez de no devolver filas.
        const result = await service.execute('c0ffee00-0000-4000-8000-000000000000');
        const response = result.toJson();

        expect(Array.isArray(response.data.items)).toBe(true);
        expect(response.data.items.length).toBe(0);
    });
});
