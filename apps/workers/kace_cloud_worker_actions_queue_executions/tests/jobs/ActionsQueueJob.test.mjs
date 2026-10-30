import { jest } from '@jest/globals';

const fakeKnexInstance = { destroy: jest.fn().mockResolvedValue(undefined) };
const fakeKnexFactory = jest.fn(() => fakeKnexInstance);
jest.unstable_mockModule('knex', () => ({ default: fakeKnexFactory }));

const fakeBuildKnexConfig = jest.fn(() => ({ client: 'pg' }));
const fakeBuildReaderConfig = jest.fn(() => ({ client: 'pg', reader: true }));
jest.unstable_mockModule('@kace/api-common', () => ({
    TenantContextManager: {
        buildKnexConfig: fakeBuildKnexConfig,
        buildReaderConfig: fakeBuildReaderConfig,
    },
}));

const fakeExecute = jest.fn().mockResolvedValue({ toJson: () => ({ successful: 7 }) });
const fakeExecutorCtor = jest.fn(() => ({ execute: fakeExecute }));
jest.unstable_mockModule(
    '@kace/core/src/actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js',
    () => ({ ActionQueueExecutionsExecutor: fakeExecutorCtor })
);

const fakeDestroyConnection = jest.fn().mockResolvedValue(undefined);
const noopRepoModule = (className) => ({ [className]: jest.fn() });
jest.unstable_mockModule('@kace/core/src/actions/index.js', () => ({ KnexActionRepository: jest.fn() }));
jest.unstable_mockModule(
    '@kace/core/src/actions-queue-executions/infrastructure/persistence/KnexActionsQueueExecutionsRepository.js',
    () => noopRepoModule('KnexActionsQueueExecutionsRepository')
);
jest.unstable_mockModule(
    '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js',
    () => noopRepoModule('KnexAutomationSettingsRepository')
);
jest.unstable_mockModule(
    '@kace/core/src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js',
    () => noopRepoModule('KnexBackgroundExecutionRepository')
);
jest.unstable_mockModule('@kace/core/src/cases/index.js', () => ({
    KnexCaseRepository: jest.fn(function () {
        this.destroyConnection = fakeDestroyConnection;
    }),
}));
jest.unstable_mockModule('@kace/core/src/grupos/index.js', () => ({ KnexGroupsRepository: jest.fn() }));
jest.unstable_mockModule('@kace/core/src/user-lists/infrastructure/persistence/KnexUserListsRepository.js', () => ({
    KnexUserListsRepository: jest.fn(),
}));
const fakeHelper = {
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logError: jest.fn(),
    logTime: jest.fn(),
    logTimeEnd: jest.fn(),
};
jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: fakeHelper,
    EventPublisher: jest.fn((bus) => ({ bus })),
}));

jest.unstable_mockModule('@kace/core/src/shared/infrastructure/persistence/PoolTelemetry.js', () => ({
    PoolTelemetry: { attach: jest.fn(() => jest.fn()) },
}));

const fakeRoutingBus = {};
const fakeBuildRoutingEventBusFromTenant = jest.fn(() => fakeRoutingBus);
jest.unstable_mockModule('@kace/core/src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js', () => ({
    buildRoutingEventBusFromTenant: fakeBuildRoutingEventBusFromTenant,
}));

const { ActionsQueueJob } = await import('../../src/jobs/ActionsQueueJob.mjs');

describe('ActionsQueueJob', () => {
    beforeEach(() => {
        fakeKnexInstance.destroy.mockClear();
        fakeKnexFactory.mockClear();
        fakeBuildKnexConfig.mockClear();
        fakeBuildReaderConfig.mockClear();
        fakeExecute.mockClear();
        fakeExecutorCtor.mockClear();
        fakeBuildRoutingEventBusFromTenant.mockClear();
        fakeBuildRoutingEventBusFromTenant.mockReturnValue(fakeRoutingBus);
        fakeDestroyConnection.mockClear();
        fakeDestroyConnection.mockResolvedValue(undefined);
        Object.values(fakeHelper).forEach((fn) => fn.mockClear());
    });

    it('name is ActionsQueueJob', () => {
        expect(new ActionsQueueJob().name).toBe('ActionsQueueJob');
    });

    it('builds Knex from tenant config, instantiates executor, runs and destroys connection', async () => {
        const tenant = { id: { value: 't-1' } };

        const result = await new ActionsQueueJob().run(tenant);

        expect(fakeBuildKnexConfig).toHaveBeenCalledWith(tenant, { poolMax: 10 });
        expect(fakeKnexFactory).toHaveBeenCalledWith({ client: 'pg' });
        expect(fakeExecutorCtor).toHaveBeenCalled();
        expect(fakeExecute).toHaveBeenCalledTimes(1);
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ successful: 7 });
    });

    it('destroys Knex even when executor throws', async () => {
        fakeExecute.mockRejectedValueOnce(new Error('executor failed'));
        const tenant = { id: { value: 't-1' } };

        await expect(new ActionsQueueJob().run(tenant)).rejects.toThrow('executor failed');
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('accepts an injected eventPublisher', async () => {
        const eventPublisher = { publish: jest.fn() };
        const tenant = { id: { value: 't-1' } };

        await new ActionsQueueJob({ eventPublisher }).run(tenant);

        const ctorArgs = fakeExecutorCtor.mock.calls[0];
        expect(ctorArgs[7]).toBe(eventPublisher);
        expect(ctorArgs[8]).toBe(tenant);
    });

    it('builds an EventPublisher via buildRoutingEventBusFromTenant when none is injected', async () => {
        const tenant = { id: { value: 't-1' } };

        await new ActionsQueueJob().run(tenant);

        expect(fakeBuildRoutingEventBusFromTenant).toHaveBeenCalledWith(tenant);
        const ctorArgs = fakeExecutorCtor.mock.calls[0];
        expect(ctorArgs[7]).toEqual({ bus: fakeRoutingBus });
        expect(ctorArgs[8]).toBe(tenant);
    });

    it('passes null eventPublisher when buildRoutingEventBusFromTenant throws', async () => {
        fakeBuildRoutingEventBusFromTenant.mockImplementationOnce(() => {
            throw new Error('missing tenant event bus configuration');
        });
        const tenant = { id: { value: 't-1' } };

        await new ActionsQueueJob().run(tenant);

        const ctorArgs = fakeExecutorCtor.mock.calls[0];
        expect(ctorArgs[7]).toBeNull();
        expect(fakeHelper.logInfo).toHaveBeenCalledWith(
            'ActionsQueueJob.eventPublisher.disabled',
            expect.objectContaining({ tenantId: 't-1', reason: 'missing tenant event bus configuration' })
        );
    });

    it('logs destroy failure without masking the original executor error', async () => {
        fakeExecute.mockRejectedValueOnce(new Error('executor failed'));
        fakeKnexInstance.destroy.mockRejectedValueOnce(new Error('pool stuck'));
        const tenant = { id: { value: 't-1' } };

        await expect(new ActionsQueueJob().run(tenant)).rejects.toThrow('executor failed');
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('still destroys Knex and preserves the original error when caseRepo teardown fails', async () => {
        fakeExecute.mockRejectedValueOnce(new Error('executor failed'));
        fakeDestroyConnection.mockRejectedValueOnce(new Error('caseRepo pool stuck'));
        const tenant = { id: { value: 't-1' } };

        await expect(new ActionsQueueJob().run(tenant)).rejects.toThrow('executor failed');
        expect(fakeDestroyConnection).toHaveBeenCalledTimes(1);
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('logs caseRepo teardown failure without propagating it when the job succeeds', async () => {
        fakeDestroyConnection.mockRejectedValueOnce(new Error('caseRepo pool stuck'));
        const tenant = { id: { value: 't-1' } };

        const result = await new ActionsQueueJob().run(tenant);

        expect(result).toEqual({ successful: 7 });
        expect(fakeDestroyConnection).toHaveBeenCalledTimes(1);
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
        expect(fakeHelper.logError).toHaveBeenCalledWith(
            'ActionsQueueJob.caseRepo.destroy.failed',
            expect.objectContaining({ tenantId: 't-1', err: 'caseRepo pool stuck' })
        );
    });
});
