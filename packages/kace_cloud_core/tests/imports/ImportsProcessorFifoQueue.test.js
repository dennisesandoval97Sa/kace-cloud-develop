import { jest } from '@jest/globals';
import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles.js';
import { S3ImportsProcessor } from '../../src/imports/application/imports-processor/S3ImportsProcessor.js';
import { BackgroundExecutionService } from '../../src/shared/domain/services/background-execution/BackgroundExecutionService.js';
import { CsvParserService } from '../../src/imports/infrastructure/csv/CsvParserService.js';
import { S3Client } from '@aws-sdk/client-s3';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { S3ImportFile } from '../../src/imports/domain/S3ImportFile.js';
import { ValueObjectUuid } from '../../src/shared/domain/value-object/ValueObjectUuid.js';

const tenant = await new LocalTenantRepository().find();

const runWithTenant = async (callback) => {
    return TenantContext.run(tenant, callback);
};

const buildFileRecord = (id, createdAt, overrides = {}) => {
    return S3ImportFile.create({
        id: id || ValueObjectUuid.random(),
        file_path: `imports/${id}.csv`,
        status: 'pending',
        upload_attempts: 0,
        total_records: 5,
        processed_records: 0,
        last_updated_at: new Date(createdAt),
        created_at: new Date(createdAt),
        created_by: ValueObjectUuid.random(),
        error_details: null,
        target_table: 'usuarios',
        ...overrides,
    });
};

describe('ImportsProcessor FIFO Queue & Chronological Rescue (User Story 3 - FR-004, FR-007, SC-003)', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('KnexS3ImportFiles.findFileToProcess builds a query ordered by created_at asc', async () => {
        const fakeChain = {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(null),
        };

        const repo = new KnexS3ImportFiles({
            client: 'pg',
            connection: {
                raw: jest.fn().mockReturnValue('NOW() - INTERVAL 15 minutes'),
            },
        });

        jest.spyOn(repo, 'table').mockReturnValue(fakeChain);

        await repo.findFileToProcess();

        expect(fakeChain.orderBy).toHaveBeenCalledWith('created_at', 'asc');
        expect(fakeChain.first).toHaveBeenCalledTimes(1);
    });

    it('S3ImportsProcessor sequentially processes multiple pending files in FIFO order until queue is empty', async () => {
        const fileId1 = ValueObjectUuid.random();
        const fileId2 = ValueObjectUuid.random();
        const fileId3 = ValueObjectUuid.random();

        const file1 = buildFileRecord(fileId1, '2026-01-01T10:00:00Z');
        const file2 = buildFileRecord(fileId2, '2026-01-01T11:00:00Z');
        const file3 = buildFileRecord(fileId3, '2026-01-01T12:00:00Z');

        const processedOrder = [];

        // Mock findFileToProcess returning file1, then file2, then file3, then null
        jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess')
            .mockResolvedValueOnce(file1)
            .mockResolvedValueOnce(file2)
            .mockResolvedValueOnce(file3)
            .mockResolvedValueOnce(null);

        jest.spyOn(KnexS3ImportFiles.prototype, 'getNotificationsConfig').mockResolvedValue(null);
        jest.spyOn(KnexS3ImportFiles.prototype, 'findUserToNotify').mockResolvedValue(null);

        jest.spyOn(KnexS3ImportFiles.prototype, 'updateImport').mockImplementation(async (id, data) => {
            if (data.status === 'processing') {
                processedOrder.push(id);
            }
            return null;
        });

        // Mock empty CSV to trigger immediate completion/rejection cycle without external S3
        jest.spyOn(CsvParserService, 'parse').mockResolvedValue([]);
        jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
            Body: {
                setEncoding() {},
                on(event, handler) {
                    if (event === 'data') handler('');
                    if (event === 'end') handler();
                    return this;
                },
            },
        });

        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution').mockResolvedValue({
            isRunning: () => false,
        });
        jest.spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution').mockResolvedValue(undefined);

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            await processor.processPendingsImports();
        });

        // Verified strict FIFO order: oldest (file1), then file2, then newest (file3)
        expect(processedOrder).toEqual([fileId1, fileId2, fileId3]);
    });

    it('rescues previously accumulated pending files automatically without manual intervention', async () => {
        // Files that were left in pending state before the current invocation
        const orphanedFileId = ValueObjectUuid.random();
        const newFileId = ValueObjectUuid.random();

        const orphanedFile = buildFileRecord(orphanedFileId, '2025-12-31T23:59:59Z');
        const newFile = buildFileRecord(newFileId, '2026-01-01T00:05:00Z');

        const executionSequence = [];

        jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess')
            .mockResolvedValueOnce(orphanedFile)
            .mockResolvedValueOnce(newFile)
            .mockResolvedValueOnce(null);

        jest.spyOn(KnexS3ImportFiles.prototype, 'getNotificationsConfig').mockResolvedValue(null);
        jest.spyOn(KnexS3ImportFiles.prototype, 'findUserToNotify').mockResolvedValue(null);

        jest.spyOn(KnexS3ImportFiles.prototype, 'updateImport').mockImplementation(async (id, data) => {
            if (data.status === 'processing') {
                executionSequence.push(id);
            }
            return null;
        });

        jest.spyOn(CsvParserService, 'parse').mockResolvedValue([]);
        jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
            Body: {
                setEncoding() {},
                on(event, handler) {
                    if (event === 'data') handler('');
                    if (event === 'end') handler();
                    return this;
                },
            },
        });

        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution').mockResolvedValue({
            isRunning: () => false,
        });
        jest.spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution').mockResolvedValue(undefined);

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            await processor.processPendingsImports();
        });

        expect(executionSequence[0]).toBe(orphanedFileId);
        expect(executionSequence[1]).toBe(newFileId);
    });

    it('does not get blocked when an older file reaches max upload attempts (>=5)', async () => {
        const poisonFileId = ValueObjectUuid.random();
        const healthyFileId = ValueObjectUuid.random();

        const poisonFile = buildFileRecord(poisonFileId, '2026-01-01T09:00:00Z', {
            upload_attempts: 5,
        });
        const validFile = buildFileRecord(healthyFileId, '2026-01-01T10:00:00Z', {
            upload_attempts: 0,
        });

        const statusUpdates = [];

        jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess')
            .mockResolvedValueOnce(poisonFile)
            .mockResolvedValueOnce(validFile)
            .mockResolvedValueOnce(null);

        jest.spyOn(KnexS3ImportFiles.prototype, 'getNotificationsConfig').mockResolvedValue(null);
        jest.spyOn(KnexS3ImportFiles.prototype, 'findUserToNotify').mockResolvedValue(null);

        jest.spyOn(KnexS3ImportFiles.prototype, 'updateImport').mockImplementation(async (id, data) => {
            statusUpdates.push({ id, status: data.status });
            return null;
        });

        jest.spyOn(CsvParserService, 'parse').mockResolvedValue([]);
        jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
            Body: {
                setEncoding() {},
                on(event, handler) {
                    if (event === 'data') handler('');
                    if (event === 'end') handler();
                    return this;
                },
            },
        });

        jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution').mockResolvedValue({
            isRunning: () => false,
        });
        jest.spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution').mockResolvedValue(undefined);

        await runWithTenant(async () => {
            const processor = new S3ImportsProcessor(() => 60_000);
            await processor.processPendingsImports();
        });

        // poison file was rejected
        expect(statusUpdates.some((u) => u.id === poisonFileId && u.status === 'rejected')).toBe(true);
        // healthy file was still reached and processed
        expect(statusUpdates.some((u) => u.id === healthyFileId && u.status === 'processing')).toBe(true);
    });
});
