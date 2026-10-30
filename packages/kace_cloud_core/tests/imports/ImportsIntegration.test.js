import { knexConfig } from '../knexfile';
import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles';
import { S3FileImport } from '../../src/imports/application/import/S3FileImport.js';
import { InvalidTargetTableError } from '../../src/imports/domain/errors/InvalidTargetTableError.js';

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

describe('S3FileImport - Integration Test', () => {
    const repository = new KnexS3ImportFiles(knexConfig);
    const service = new S3FileImport(repository);

    it('should insert a new import record into DB when table is valid', async () => {
        await service.execute(validDto);

        const rows = await repository.connection('s3_import_files').where({ id: validDto.id });
        expect(rows.length).toBe(1);
        expect(rows[0].target_table).toBe('usuarios');
    });

    it('should throw InvalidTargetTableError if table does not exist', async () => {
        const invalidDto = { ...validDto, target_table: 'non_existing_table' };

        await expect(service.execute(invalidDto)).rejects.toThrow(InvalidTargetTableError);
    });
});
