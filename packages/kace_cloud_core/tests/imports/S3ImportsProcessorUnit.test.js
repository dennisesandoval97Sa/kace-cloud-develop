import { jest } from '@jest/globals';
import { S3ImportsProcessor } from '../../src/imports/application/imports-processor/S3ImportsProcessor.js';
import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles.js';
import { BackgroundExecutionService } from '../../src/shared/domain/services/background-execution/BackgroundExecutionService.js';
import { CsvParserService } from '../../src/imports/infrastructure/csv/CsvParserService.js';
import { S3Client } from '@aws-sdk/client-s3';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { ValueObjectUuid } from '../../src/shared/domain/value-object/ValueObjectUuid.js';

const tenant = await new LocalTenantRepository().find();

const runWithTenant = async (callback) => {
    return TenantContext.run(tenant, callback);
};

const buildFileRecord = (overrides = {}) => ({
    id: { value: 'import-id-1' },
    created_by: { value: 'user-1' },
    file_path: { value: 'bucket-name/imports/file.csv' },
    target_table: { value: 'usuarios' },
    upload_attempts: { value: 0 },
    error_details: null,
    ...overrides,
});

const mockProcessableImportFlow = ({ fileRecord = buildFileRecord(), csvContent = [] } = {}) => {
    jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess')
        .mockResolvedValueOnce(fileRecord)
        .mockResolvedValueOnce(null);
    jest.spyOn(KnexS3ImportFiles.prototype, 'getNotificationsConfig').mockResolvedValue(null);
    jest.spyOn(KnexS3ImportFiles.prototype, 'findUserToNotify').mockResolvedValue(null);
    jest.spyOn(KnexS3ImportFiles.prototype, 'updateImport').mockResolvedValue(undefined);
    jest.spyOn(CsvParserService, 'parse').mockResolvedValue(csvContent);
    jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        Body: {
            setEncoding() {},
            on(event, handler) {
                if (event === 'data') {
                    handler('');
                }
                if (event === 'end') {
                    handler();
                }
                return this;
            },
        },
    });
};

describe('S3ImportsProcessor', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('does not start next import when remaining time is too low', async () => {
        const findFileSpy = jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess').mockResolvedValue(null);
        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution').mockResolvedValue({
            isRunning: () => false,
        });
        jest.spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution').mockResolvedValue(undefined);

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 5_000);
            const result = await processor.processPendingsImports();
            expect(result).toEqual({ skipped: 'time' });
        });

        expect(findFileSpy).not.toHaveBeenCalled();
    });

    it('skips processing when background is already running and not stale', async () => {
        const findFileSpy = jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess').mockResolvedValue(null);
        const updateBackgroundSpy = jest
            .spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution')
            .mockResolvedValue(undefined);

        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution').mockResolvedValue({
            isRunning: () => true,
            isStale: () => false,
        });

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            const result = await processor.processPendingsImports();
            expect(result).toEqual({ skipped: 'locked' });
        });

        expect(findFileSpy).not.toHaveBeenCalled();
        expect(updateBackgroundSpy).not.toHaveBeenCalled();
    });

    it('takes over processing when background is stale', async () => {
        jest.spyOn(ValueObjectUuid, 'random').mockReturnValue('owner-1');
        const updateBackgroundSpy = jest
            .spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution')
            .mockResolvedValue(undefined);

        jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess').mockResolvedValue(null);
        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution')
            .mockResolvedValueOnce({
                isRunning: () => true,
                isStale: () => true,
            })
            .mockResolvedValueOnce({
                updated_by: { value: 'owner-1' },
            });

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            await processor.processPendingsImports();
        });

        expect(updateBackgroundSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                execution_status: true,
                updated_by: 'owner-1',
            })
        );
    });

    it('releases background process only if current execution is the owner', async () => {
        jest.spyOn(ValueObjectUuid, 'random').mockReturnValue('owner-123');
        const updateBackgroundSpy = jest
            .spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution')
            .mockResolvedValue(undefined);

        jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess').mockResolvedValue(null);
        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution')
            .mockResolvedValueOnce({
                isRunning: () => false,
            })
            .mockResolvedValueOnce({
                updated_by: { value: 'owner-123' },
            });

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            await processor.processPendingsImports();
        });

        expect(updateBackgroundSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                execution_status: false,
                updated_by: 'owner-123',
            })
        );
    });

    it('does not release background process if another execution owns the lock', async () => {
        jest.spyOn(ValueObjectUuid, 'random').mockReturnValue('owner-123');
        const updateBackgroundSpy = jest
            .spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution')
            .mockResolvedValue(undefined);

        jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess').mockResolvedValue(null);
        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution')
            .mockResolvedValueOnce({
                isRunning: () => false,
            })
            .mockResolvedValueOnce({
                updated_by: { value: 'owner-999' },
            });

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            await processor.processPendingsImports();
        });

        expect(updateBackgroundSpy).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                execution_status: false,
            })
        );
    });

    it('renews heartbeat when there is still work to do', async () => {
        jest.spyOn(ValueObjectUuid, 'random').mockReturnValue('owner-heartbeat');
        const updateBackgroundSpy = jest
            .spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution')
            .mockResolvedValue(undefined);

        mockProcessableImportFlow({
            fileRecord: buildFileRecord(),
            csvContent: [],
        });

        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution')
            .mockResolvedValueOnce({
                isRunning: () => false,
            })
            .mockResolvedValueOnce({
                updated_by: { value: 'owner-heartbeat' },
            });

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            await processor.processPendingsImports();
        });

        expect(updateBackgroundSpy).toHaveBeenCalledTimes(3);
        expect(updateBackgroundSpy).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({
                execution_status: true,
                updated_by: 'owner-heartbeat',
            })
        );
        expect(updateBackgroundSpy).toHaveBeenNthCalledWith(
            3,
            expect.anything(),
            expect.objectContaining({
                execution_status: false,
                updated_by: 'owner-heartbeat',
            })
        );
    });

    it('stops processing when heartbeat refresh fails', async () => {
        jest.spyOn(ValueObjectUuid, 'random').mockReturnValue('owner-heartbeat-fails');
        const findFileSpy = jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess');
        const updateBackgroundSpy = jest
            .spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution')
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('heartbeat failure'));

        mockProcessableImportFlow({
            fileRecord: buildFileRecord(),
            csvContent: [],
        });

        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution')
            .mockResolvedValueOnce({
                isRunning: () => false,
            })
            .mockResolvedValueOnce({
                updated_by: { value: 'owner-heartbeat-fails' },
            });

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            await processor.processPendingsImports();
        });

        expect(findFileSpy).toHaveBeenCalledTimes(1);
        expect(updateBackgroundSpy).toHaveBeenCalledTimes(3);
        expect(updateBackgroundSpy).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({
                execution_status: true,
                updated_by: 'owner-heartbeat-fails',
            })
        );
        expect(updateBackgroundSpy).toHaveBeenNthCalledWith(
            3,
            expect.anything(),
            expect.objectContaining({
                execution_status: false,
                updated_by: 'owner-heartbeat-fails',
            })
        );
    });
});
