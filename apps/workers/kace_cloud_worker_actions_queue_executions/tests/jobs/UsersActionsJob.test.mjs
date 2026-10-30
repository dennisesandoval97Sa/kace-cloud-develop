import { jest } from '@jest/globals';

const fakeKnexInstance = { destroy: jest.fn().mockResolvedValue(undefined) };
const fakeKnexFactory = jest.fn(() => fakeKnexInstance);
jest.unstable_mockModule('knex', () => ({ default: fakeKnexFactory }));

const fakeBuildKnexConfig = jest.fn(() => ({ client: 'pg' }));
jest.unstable_mockModule('@kace/api-common', () => ({
    TenantContextManager: { buildKnexConfig: fakeBuildKnexConfig },
}));

const fakeFinderExecute = jest.fn();
const fakeFinderCtor = jest.fn(() => ({ execute: fakeFinderExecute }));
jest.unstable_mockModule('@kace/core/src/actions/domain/services/FinderByTrigger.js', () => ({
    FinderByTrigger: fakeFinderCtor,
}));

const fakeActionRepoCtor = jest.fn();
jest.unstable_mockModule('@kace/core/src/actions/index.js', () => ({
    KnexActionRepository: fakeActionRepoCtor,
}));

const fakeFindAllActive = jest.fn();
const fakeUsersRepoCtor = jest.fn(() => ({ findAllActive: fakeFindAllActive, connection: fakeKnexInstance }));
jest.unstable_mockModule('@kace/core/src/users/index.js', () => ({
    KnexUsersRepository: fakeUsersRepoCtor,
}));

const fakeExecuteForCron = jest.fn();
const fakeFactoryCreate = jest.fn(() => ({ executeForCron: fakeExecuteForCron }));
jest.unstable_mockModule('@kace/core/src/actions/infrastructure/EntityActionExecutionServiceFactory.js', () => ({
    EntityActionExecutionServiceFactory: { create: fakeFactoryCreate },
}));

const fakeAutomationSettingsRepoCtor = jest.fn();
jest.unstable_mockModule(
    '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js',
    () => ({ KnexAutomationSettingsRepository: fakeAutomationSettingsRepoCtor })
);

const fakeAutomationValidationExecute = jest.fn();
const fakeAutomationValidationCtor = jest.fn(() => ({ execute: fakeAutomationValidationExecute }));
jest.unstable_mockModule('@kace/core/src/automation-settings/domain/AutomationValidationService.js', () => ({
    AutomationValidationService: fakeAutomationValidationCtor,
}));

jest.unstable_mockModule('@kace/core/src/shared/domain/enum/ActionTriggersEnum.js', () => ({
    ActionTriggers: { CRON_JOB: { value: 'cron_job' } },
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logError: jest.fn(), logDebug: jest.fn(), logInfo: jest.fn() },
}));

const { UsersActionsJob } = await import('../../src/jobs/UsersActionsJob.mjs');

describe('UsersActionsJob', () => {
    const tenant = { id: { value: 't-1' } };

    beforeEach(() => {
        fakeKnexInstance.destroy.mockClear();
        fakeKnexFactory.mockClear();
        fakeBuildKnexConfig.mockClear();
        fakeFinderExecute.mockReset();
        fakeFindAllActive.mockReset();
        fakeExecuteForCron.mockReset();
        fakeFactoryCreate.mockClear();
        fakeAutomationValidationExecute.mockReset();
        fakeAutomationValidationExecute.mockResolvedValue(true);
        fakeAutomationValidationCtor.mockClear();
        fakeAutomationSettingsRepoCtor.mockClear();
    });

    it('name is UsersActionsJob', () => {
        expect(new UsersActionsJob().name).toBe('UsersActionsJob');
    });

    it('returns zero counters when no actions are found and skips entity load', async () => {
        fakeFinderExecute.mockResolvedValueOnce([]);

        const result = await new UsersActionsJob().run(tenant);

        expect(fakeFinderExecute).toHaveBeenCalledWith('cron_job', { entityFilter: 'user' });
        expect(fakeFindAllActive).not.toHaveBeenCalled();
        expect(fakeExecuteForCron).not.toHaveBeenCalled();
        expect(result).toEqual({ processed: 0, matched: 0, executed: 0, failed: 0 });
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('returns zero counters when no active users exist', async () => {
        fakeFinderExecute.mockResolvedValueOnce([{ id: { value: 'a-1' }, automation_id: { value: 'auto-1' } }]);
        fakeFindAllActive.mockResolvedValueOnce([]);

        const result = await new UsersActionsJob().run(tenant);

        expect(fakeFindAllActive).toHaveBeenCalledTimes(1);
        expect(fakeExecuteForCron).not.toHaveBeenCalled();
        expect(result).toEqual({ processed: 0, matched: 0, executed: 0, failed: 0 });
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('builds service from factory and delegates to executeForCron', async () => {
        const actions = [{ id: { value: 'a-1' }, automation_id: { value: 'auto-1' } }];
        const users = [{ id: { value: 'u-1' } }];
        const counters = { processed: 1, matched: 1, executed: 1, failed: 0 };
        fakeFinderExecute.mockResolvedValueOnce(actions);
        fakeFindAllActive.mockResolvedValueOnce(users);
        fakeExecuteForCron.mockResolvedValueOnce(counters);

        const result = await new UsersActionsJob().run(tenant);

        expect(fakeFactoryCreate).toHaveBeenCalledTimes(1);
        expect(fakeExecuteForCron).toHaveBeenCalledWith(actions, users);
        expect(result).toBe(counters);
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('filters out actions whose automation cron is not due before calling executeForCron', async () => {
        const dueAction = { id: { value: 'a-1' }, automation_id: { value: 'auto-due' } };
        const notDueAction = { id: { value: 'a-2' }, automation_id: { value: 'auto-not-due' } };
        const users = [{ id: { value: 'u-1' } }];
        const counters = { processed: 1, matched: 1, executed: 1, failed: 0 };
        fakeFinderExecute.mockResolvedValueOnce([dueAction, notDueAction]);
        fakeFindAllActive.mockResolvedValueOnce(users);
        fakeAutomationValidationExecute.mockImplementation(async (id) => id === 'auto-due');
        fakeExecuteForCron.mockResolvedValueOnce(counters);

        const result = await new UsersActionsJob().run(tenant);

        expect(fakeAutomationValidationExecute).toHaveBeenCalledWith('auto-due');
        expect(fakeAutomationValidationExecute).toHaveBeenCalledWith('auto-not-due');
        expect(fakeExecuteForCron).toHaveBeenCalledWith([dueAction], users);
        expect(result).toBe(counters);
    });

    it('skips findAllActive and returns zero counters when no actions are due this tick', async () => {
        const actions = [
            { id: { value: 'a-1' }, automation_id: { value: 'auto-1' } },
            { id: { value: 'a-2' }, automation_id: { value: 'auto-2' } },
        ];
        fakeFinderExecute.mockResolvedValueOnce(actions);
        fakeAutomationValidationExecute.mockResolvedValue(false);

        const result = await new UsersActionsJob().run(tenant);

        expect(fakeFindAllActive).not.toHaveBeenCalled();
        expect(fakeExecuteForCron).not.toHaveBeenCalled();
        expect(result).toEqual({ processed: 0, matched: 0, executed: 0, failed: 0 });
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('destroys knex even when finder throws', async () => {
        fakeFinderExecute.mockRejectedValueOnce(new Error('finder failed'));

        await expect(new UsersActionsJob().run(tenant)).rejects.toThrow('finder failed');
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('destroys knex even when findAllActive throws', async () => {
        fakeFinderExecute.mockResolvedValueOnce([{ id: { value: 'a-1' }, automation_id: { value: 'auto-1' } }]);
        fakeFindAllActive.mockRejectedValueOnce(new Error('repo failed'));

        await expect(new UsersActionsJob().run(tenant)).rejects.toThrow('repo failed');
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('logs and does not propagate when knex.destroy fails', async () => {
        fakeFinderExecute.mockResolvedValueOnce([]);
        fakeKnexInstance.destroy.mockRejectedValueOnce(new Error('pool stuck'));

        const result = await new UsersActionsJob().run(tenant);

        expect(result).toEqual({ processed: 0, matched: 0, executed: 0, failed: 0 });
    });
});
