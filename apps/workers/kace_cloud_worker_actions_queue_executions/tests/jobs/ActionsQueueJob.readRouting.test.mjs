import { jest } from '@jest/globals';

const buildReaderConfigMock = jest.fn(() => ({
    client: 'pg',
    connection: { host: 'reader.local' },
    pool: { min: 0, max: 10 },
    schema: 'tenant_x',
}));
const buildKnexConfigMock = jest.fn(() => ({
    client: 'pg',
    connection: { host: 'writer.local' },
    pool: { min: 0, max: 10 },
    schema: 'tenant_x',
}));

const hasWrittenInsideRun = { value: undefined };
const caseRepoArgs = { value: undefined };

jest.unstable_mockModule('@kace/api-common', () => ({
    TenantContextManager: {
        buildKnexConfig: buildKnexConfigMock,
        buildReaderConfig: buildReaderConfigMock,
    },
}));

jest.unstable_mockModule('knex', () => ({
    default: jest.fn(() => {
        const fn = () => fn;
        fn.destroy = jest.fn(async () => {});
        fn.client = { config: { client: 'pg' } };
        return fn;
    }),
}));

jest.unstable_mockModule('@kace/core/src/shared/infrastructure/context/DbRequestContext.js', () => ({
    DbRequestContext: {
        runForJob: jest.fn((fn) => fn()),
        hasWritten: jest.fn(() => false),
        markWrite: jest.fn(),
    },
}));

jest.unstable_mockModule('@kace/core/src/cases/index.js', () => ({
    KnexCaseRepository: jest.fn(function (...args) {
        caseRepoArgs.value = args;
        this.destroyConnection = jest.fn(async () => {});
    }),
}));

// Stub the remaining repos/executor so run() can complete without a DB.
const stubRepo = jest.fn(function () {});
jest.unstable_mockModule('@kace/core/src/actions/index.js', () => ({ KnexActionRepository: stubRepo }));
jest.unstable_mockModule(
    '@kace/core/src/actions-queue-executions/infrastructure/persistence/KnexActionsQueueExecutionsRepository.js',
    () => ({ KnexActionsQueueExecutionsRepository: stubRepo })
);
jest.unstable_mockModule(
    '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js',
    () => ({ KnexAutomationSettingsRepository: stubRepo })
);
jest.unstable_mockModule(
    '@kace/core/src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js',
    () => ({ KnexBackgroundExecutionRepository: stubRepo })
);
jest.unstable_mockModule('@kace/core/src/grupos/index.js', () => ({ KnexGroupsRepository: stubRepo }));
jest.unstable_mockModule('@kace/core/src/user-lists/infrastructure/persistence/KnexUserListsRepository.js', () => ({
    KnexUserListsRepository: stubRepo,
}));
jest.unstable_mockModule(
    '@kace/core/src/actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js',
    () => ({
        ActionQueueExecutionsExecutor: jest.fn(function () {
            this.execute = jest.fn(async () => ({
                toJson: () => ({ successful: 0, failed: 0, duplicate: 0 }),
            }));
        }),
    })
);
jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    EventPublisher: jest.fn(),
    Helper: {
        logTime: jest.fn(),
        logTimeEnd: jest.fn(),
        logInfo: jest.fn(),
        logDebug: jest.fn(),
        logError: jest.fn(),
    },
}));
jest.unstable_mockModule('@kace/core/src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js', () => ({
    buildRoutingEventBusFromTenant: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/shared/infrastructure/persistence/PoolTelemetry.js', () => ({
    PoolTelemetry: { attach: jest.fn(() => jest.fn()) },
}));

const { ActionsQueueJob } = await import('../../src/jobs/ActionsQueueJob.mjs');
const { DbRequestContext } = await import('@kace/core/src/shared/infrastructure/context/DbRequestContext.js');

const tenant = { id: { value: 'tenant-x' } };

describe('ActionsQueueJob — read routing wiring', () => {
    beforeEach(() => {
        caseRepoArgs.value = undefined;
        hasWrittenInsideRun.value = undefined;
        buildReaderConfigMock.mockClear();
        buildKnexConfigMock.mockClear();
    });

    it('wraps the job body in DbRequestContext.runForJob', async () => {
        const job = new ActionsQueueJob({ eventPublisher: {} });
        await job.run(tenant);
        expect(DbRequestContext.runForJob).toHaveBeenCalledTimes(1);
    });

    it('builds a reader config and passes it to KnexCaseRepository as the 2nd arg', async () => {
        const job = new ActionsQueueJob({ eventPublisher: {} });
        await job.run(tenant);
        expect(buildReaderConfigMock).toHaveBeenCalledWith(tenant, { poolMax: 10 });
        // [writerConfig, readerConfig]
        expect(caseRepoArgs.value).toHaveLength(2);
        expect(caseRepoArgs.value[1]).toEqual(expect.objectContaining({ connection: { host: 'reader.local' } }));
    });
});
