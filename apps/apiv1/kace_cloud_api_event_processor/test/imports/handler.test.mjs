import { jest } from '@jest/globals';

let capturedRemainingTimeFn = null;
const processPendingsImportsMock = jest.fn().mockResolvedValue({ skipped: null });

jest.unstable_mockModule('@kace/core/src/imports/application/imports-processor/S3ImportsProcessor.js', () => ({
    S3ImportsProcessor: jest.fn().mockImplementation((remainingTimeFn) => {
        capturedRemainingTimeFn = remainingTimeFn;
        return {
            processPendingsImports: processPendingsImportsMock,
        };
    }),
}));

jest.unstable_mockModule('@kace/api-common/src/middleware/TenantContextManager.js', () => ({
    TenantContextManager: {
        getTenant: jest.fn().mockResolvedValue({ id: { value: 'tenant-123' } }),
        buildKnexConfig: jest.fn().mockReturnValue({}),
        buildReaderConfig: jest.fn().mockReturnValue({}),
    },
}));

jest.unstable_mockModule('@kace/core/src/shared/infrastructure/context/TenantContext.js', () => ({
    TenantContext: {
        run: jest.fn(async (_tenant, fn) => fn()),
        getTenant: jest.fn().mockReturnValue({ id: { value: 'tenant-123' } }),
        getTenantId: jest.fn().mockReturnValue('tenant-123'),
        getService: jest.fn().mockReturnValue(null),
        buildKnexConfig: jest.fn().mockReturnValue({}),
    },
}));

jest.unstable_mockModule('@kace/core/src/users/index.js', () => ({
    KnexUsersRepository: jest.fn().mockImplementation(() => ({
        connection: {},
        destroyConnection: jest.fn().mockResolvedValue(undefined),
    })),
}));

jest.unstable_mockModule('../../src/shared/runWithDeduplication.mjs', () => ({
    runWithDeduplication: jest.fn(async (domainEvent, _userRepo, handlerFactories) => {
        const factory = handlerFactories.get(domainEvent.eventName);
        if (factory) {
            await factory({ getRemainingTimeInMillis: () => 60000 }, domainEvent);
        }
        return { deduped: false };
    }),
}));

const { handler } = await import('../../src/imports/handler.mjs');
const { S3ImportsProcessor } =
    await import('@kace/core/src/imports/application/imports-processor/S3ImportsProcessor.js');

describe('ImportsEventProcessor handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        capturedRemainingTimeFn = null;
        processPendingsImportsMock.mockResolvedValue({ skipped: null });
    });

    it('exports a valid Lambda handler function', () => {
        expect(typeof handler).toBe('function');
    });

    it('processes ImportExecutionRequested event, applies STOP_BUFFER_MS (30s) and succeeds', async () => {
        const fileId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
        const eventId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
        const sqsEvent = {
            Records: [
                {
                    messageId: 'msg-import-1',
                    body: JSON.stringify({
                        eventId,
                        eventName: 'kace.core.import_execution.requested',
                        aggregateId: fileId,
                        occurredOn: new Date().toISOString(),
                        payload: { fileId, targetTable: 'usuarios', actionType: 'CREATE' },
                        metadata: { tenant_id: 'tenant-123' },
                    }),
                },
            ],
        };

        const result = await handler(sqsEvent, {
            getRemainingTimeInMillis: () => 60000,
        });

        expect(result).toEqual({ batchItemFailures: [] });
        expect(S3ImportsProcessor).toHaveBeenCalled();
        expect(processPendingsImportsMock).toHaveBeenCalledTimes(1);

        // Validates STOP_BUFFER_MS = 30_000 deduction
        expect(typeof capturedRemainingTimeFn).toBe('function');
        expect(capturedRemainingTimeFn()).toBe(30000);
    });

    it('acknowledges message without batchItemFailures when imports execution was skipped due to lock', async () => {
        processPendingsImportsMock.mockResolvedValueOnce({ skipped: 'locked' });

        const fileId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
        const eventId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
        const sqsEvent = {
            Records: [
                {
                    messageId: 'msg-import-locked',
                    body: JSON.stringify({
                        eventId,
                        eventName: 'kace.core.import_execution.requested',
                        aggregateId: fileId,
                        occurredOn: new Date().toISOString(),
                        payload: { fileId, targetTable: 'usuarios', actionType: 'CREATE' },
                        metadata: { tenant_id: 'tenant-123' },
                    }),
                },
            ],
        };

        const result = await handler(sqsEvent, {
            getRemainingTimeInMillis: () => 60000,
        });

        // The message is acknowledged (no batchItemFailures) because the lock holder or sweep will process it
        expect(result).toEqual({ batchItemFailures: [] });
        expect(processPendingsImportsMock).toHaveBeenCalledTimes(1);
    });

    it('returns batchItemFailures when imports execution throws a critical error', async () => {
        processPendingsImportsMock.mockRejectedValueOnce(new Error('Database connection failed'));

        const fileId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
        const eventId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
        const sqsEvent = {
            Records: [
                {
                    messageId: 'msg-import-error',
                    body: JSON.stringify({
                        eventId,
                        eventName: 'kace.core.import_execution.requested',
                        aggregateId: fileId,
                        occurredOn: new Date().toISOString(),
                        payload: { fileId, targetTable: 'usuarios', actionType: 'CREATE' },
                        metadata: { tenant_id: 'tenant-123' },
                    }),
                },
            ],
        };

        const result = await handler(sqsEvent, {
            getRemainingTimeInMillis: () => 60000,
        });

        expect(result).toEqual({
            batchItemFailures: [{ itemIdentifier: 'msg-import-error' }],
        });
        expect(processPendingsImportsMock).toHaveBeenCalledTimes(1);
    });
});
