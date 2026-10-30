import { jest } from '@jest/globals';
import { S3FileImport } from '../../../../src/imports/application/import/S3FileImport.js';
import { S3ImportFile } from '../../../../src/imports/domain/S3ImportFile.js';
import { InvalidTargetTableError } from '../../../../src/imports/domain/errors/InvalidTargetTableError.js';

describe('S3FileImport execute()', () => {
    const mockRepository = {
        getSchemaTables: jest.fn(),
        save: jest.fn(),
    };

    const validDto = {
        file_path: 'bucket/my-file.csv',
        status: 'pending',
        upload_attempts: 0,
        total_records: 0,
        processed_records: 0,
        last_updated_at: new Date(),
        created_at: new Date(),
        created_by: '07b10825-6cce-4150-a32c-7a9e4c7eddae',
        target_table: 'usuarios',
        action_type: 'CREATE',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the persisted S3ImportFile id upon successful execution', async () => {
        mockRepository.getSchemaTables.mockResolvedValue(['usuarios']);
        const service = new S3FileImport(mockRepository);

        const fileId = await service.execute(validDto);

        expect(mockRepository.getSchemaTables).toHaveBeenCalled();
        expect(mockRepository.save).toHaveBeenCalledTimes(1);
        const savedEntity = mockRepository.save.mock.calls[0][0];
        expect(savedEntity).toBeInstanceOf(S3ImportFile);
        expect(typeof fileId).toBe('string');
        expect(fileId).toBe(savedEntity.id.value);
    });

    it('throws InvalidTargetTableError when target table is not valid', async () => {
        mockRepository.getSchemaTables.mockResolvedValue(['usuarios']);
        const service = new S3FileImport(mockRepository);

        await expect(service.execute({ ...validDto, target_table: 'non_existent' })).rejects.toThrow(
            InvalidTargetTableError
        );
        expect(mockRepository.save).not.toHaveBeenCalled();
    });
});
