import { jest } from '@jest/globals';
import { Readable } from 'node:stream';
import { S3ImportFile } from '../../src/imports/domain/S3ImportFile.js';
import { TenantContext } from '../../src/shared/index.js';

const mockS3Send = jest.fn();
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn().mockImplementation(() => ({
        send: mockS3Send,
    })),
    GetObjectCommand: jest.fn().mockImplementation((params) => params),
}));

const mockUpdateImport = jest.fn().mockResolvedValue(undefined);
const mockFindFileToProcess = jest.fn();
const mockGetNotificationsConfig = jest.fn();
const mockFindUserToNotify = jest.fn();

const fakeDbConn = jest.fn();
fakeDbConn.client = {};

jest.unstable_mockModule('../../src/imports/infrastructure/persistence/KnexS3ImportFiles.js', () => ({
    KnexS3ImportFiles: jest.fn().mockImplementation(() => ({
        findFileToProcess: mockFindFileToProcess,
        updateImport: mockUpdateImport,
        getNotificationsConfig: mockGetNotificationsConfig,
        findUserToNotify: mockFindUserToNotify,
        connection: fakeDbConn,
    })),
}));

jest.unstable_mockModule('../../src/users/index.js', () => ({
    KnexUsersRepository: jest.fn().mockImplementation(() => ({
        connection: {},
    })),
}));

jest.unstable_mockModule('../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js', () => ({
    KnexSecretsVaultRepository: jest.fn().mockImplementation(() => ({
        connection: {},
    })),
}));

const mockEmailExecute = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../../src/mails/index.js', () => ({
    EmailService: jest.fn().mockImplementation(() => ({
        execute: mockEmailExecute,
    })),
    Mail: {
        create: jest.fn((config) => config),
    },
}));

let currentOwnerId = null;
const mockUpdateBackgroundExecution = jest.fn().mockImplementation((_proc, data) => {
    if (data.updated_by) currentOwnerId = data.updated_by;
    return Promise.resolve();
});
const mockFindBackgroundExecution = jest.fn().mockImplementation(() => {
    if (!currentOwnerId) return Promise.resolve(null);
    return Promise.resolve({
        isRunning: () => false,
        updated_by: { value: currentOwnerId },
    });
});

jest.unstable_mockModule('../../src/shared/domain/services/background-execution/BackgroundExecutionService.js', () => ({
    BackgroundExecutionService: jest.fn().mockImplementation(() => ({
        updateBackgroundExecution: mockUpdateBackgroundExecution,
        findBackgroundExecution: mockFindBackgroundExecution,
    })),
}));

jest.unstable_mockModule(
    '../../src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js',
    () => ({
        KnexBackgroundExecutionRepository: jest.fn().mockImplementation(() => ({})),
    })
);

const fakeTenant = {
    id: { value: 'tenant-123' },
    aws_s3_region: { value: 'us-east-1' },
    aws_s3_access_key_id: { value: 'key' },
    aws_s3_secret_access_key: { value: 'secret' },
    aws_s3_bucket: { value: 'test-bucket' },
    buildKnexConfig: jest.fn().mockReturnValue(jest.fn()),
};

const { S3ImportsProcessor } = await import('../../src/imports/application/imports-processor/S3ImportsProcessor.js');

function createStreamFromString(str) {
    const stream = new Readable();
    stream.push(str);
    stream.push(null);
    return stream;
}

describe('S3ImportsProcessor Rejection & Notification (US2)', () => {
    const fileId = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e';
    const userId = 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f';

    const sampleFileRecord = new S3ImportFile({
        id: fileId,
        file_path: 'imports/empty.csv',
        status: 'pending',
        upload_attempts: 0,
        total_records: 0,
        processed_records: 0,
        last_updated_at: new Date(),
        created_at: new Date(),
        created_by: userId,
        target_table: 'usuarios',
        action_type: 'IMPORT',
    });

    const fakeUser = {
        id: { value: userId },
        nombres: { value: 'Juan' },
        email: { value: 'juan@example.com' },
    };

    const fakeMailAccount = {
        id: { value: 'mail-123' },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetNotificationsConfig.mockResolvedValue(fakeMailAccount);
        mockFindUserToNotify.mockResolvedValue(fakeUser);
    });

    it('rejects 0-byte/empty CSV files, records error details, dispatches notification and releases lock', async () => {
        mockFindFileToProcess.mockResolvedValueOnce(sampleFileRecord).mockResolvedValue(null);
        mockS3Send.mockResolvedValue({
            Body: createStreamFromString(''),
        });

        await TenantContext.run(fakeTenant, async () => {
            const processor = new S3ImportsProcessor(() => 30000);
            await processor.processPendingsImports();
        });

        // 1. Should update import status to rejected with descriptive error
        expect(mockUpdateImport).toHaveBeenCalledWith(
            fileId,
            expect.objectContaining({
                status: 'rejected',
                error_details: expect.stringContaining('vacio'),
            })
        );

        // 2. Should notify user of rejection
        expect(mockEmailExecute).toHaveBeenCalledTimes(1);
        const [dispatchedMail] = mockEmailExecute.mock.calls[0];
        expect(dispatchedMail.to).toEqual(['juan@example.com']);
        expect(dispatchedMail.content).toContain('no pudo ser cargado correctamente');

        // 3. Background lock must be released in finally
        expect(mockUpdateBackgroundExecution).toHaveBeenCalledWith(
            'imports_processor',
            expect.objectContaining({ execution_status: false })
        );
    });

    it('rejects files with invalid CSV structure (missing required columns for usuarios) and dispatches notification', async () => {
        const invalidStructureFileRecord = new S3ImportFile({
            id: fileId,
            file_path: 'imports/invalid_cols.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 0,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userId,
            target_table: 'usuarios',
            action_type: 'IMPORT',
        });

        mockFindFileToProcess.mockResolvedValueOnce(invalidStructureFileRecord).mockResolvedValue(null);
        mockS3Send.mockResolvedValue({
            Body: createStreamFromString('col1,col2\nval1,val2\n'),
        });

        await TenantContext.run(fakeTenant, async () => {
            const processor = new S3ImportsProcessor(() => 30000);
            await processor.processPendingsImports();
        });

        // 1. Should update status to rejected with structure validation error
        expect(mockUpdateImport).toHaveBeenCalledWith(
            fileId,
            expect.objectContaining({
                status: 'rejected',
                error_details: expect.any(String),
            })
        );

        // 2. Should notify user of rejection
        expect(mockEmailExecute).toHaveBeenCalledTimes(1);
        const [dispatchedMail] = mockEmailExecute.mock.calls[0];
        expect(dispatchedMail.to).toEqual(['juan@example.com']);
        expect(dispatchedMail.content).toContain('no pudo ser cargado correctamente');
    });
});
