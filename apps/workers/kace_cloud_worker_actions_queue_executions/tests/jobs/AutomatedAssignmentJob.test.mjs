import { jest } from '@jest/globals';

const fakeKnexInstance = { destroy: jest.fn().mockResolvedValue(undefined) };
const fakeKnexFactory = jest.fn(() => fakeKnexInstance);
jest.unstable_mockModule('knex', () => ({ default: fakeKnexFactory }));

jest.unstable_mockModule('@kace/api-common', () => ({
    TenantContextManager: { buildKnexConfig: jest.fn(() => ({ client: 'pg' })) },
}));

const fakeExecute = jest.fn().mockResolvedValue({ assigned: 3, skipped: 0, errors: 0, noActions: false });
const fakeExecutorCtor = jest.fn(() => ({ execute: fakeExecute }));
jest.unstable_mockModule(
    '@kace/core/src/actions-queue-executions/application/executions/AutomatedGroupAssignmentExecutor.js',
    () => ({ AutomatedGroupAssignmentExecutor: fakeExecutorCtor })
);

const mockRunObserver = {
    recordStart: jest.fn(),
    recordError: jest.fn(),
    persist: jest.fn().mockResolvedValue(null),
};
const fakeAssignmentRunObserverCtor = jest.fn(() => mockRunObserver);
jest.unstable_mockModule('@kace/core/src/automated-assignment-runs/domain/services/AssignmentRunObserver.js', () => ({
    AssignmentRunObserver: fakeAssignmentRunObserverCtor,
}));

const mockRunsRepository = { purgeOlderThan: jest.fn().mockResolvedValue(0) };
const fakeRunsRepositoryCtor = jest.fn(() => mockRunsRepository);
jest.unstable_mockModule(
    '@kace/core/src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentRunsRepository.js',
    () => ({ KnexAutomatedAssignmentRunsRepository: fakeRunsRepositoryCtor })
);

const fakeLogError = jest.fn();
jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: {
        logError: fakeLogError,
        logInfo: jest.fn(),
        logDebug: jest.fn(),
        logTime: jest.fn(),
        logTimeEnd: jest.fn(),
    },
}));

// Trackable ctors for the services we want to assert wiring on.
const fakeAutomatedGroupAssignmentServiceCtor = jest.fn();
const fakeLegacyAutomatedGroupAssignmentServiceCtor = jest.fn();
const fakeEntityCandidateFinderCtor = jest.fn();
const fakeCaseContextBatchLoaderCtor = jest.fn();
const fakeActionConditionsToSqlTranslatorCtor = jest.fn();

// Stub all collaborator repos and services as minimal jest.fn() ctors so wiring resolves.
const mockExports = {
    '@kace/core/src/actions/index.js': { KnexActionRepository: jest.fn() },
    '@kace/core/src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentBacklogSnapshotsRepository.js':
        { KnexAutomatedAssignmentBacklogSnapshotsRepository: jest.fn() },
    '@kace/core/src/actions-queue-executions/domain/services/ActionsProcessor.js': {
        ActionsProcessor: jest.fn(),
    },
    '@kace/core/src/actions-queue-executions/domain/services/AutomatedGroupAssignmentService.js': {
        AutomatedGroupAssignmentService: fakeAutomatedGroupAssignmentServiceCtor,
    },
    '@kace/core/src/actions-queue-executions/domain/services/LegacyAutomatedGroupAssignmentService.js': {
        LegacyAutomatedGroupAssignmentService: fakeLegacyAutomatedGroupAssignmentServiceCtor,
    },
    '@kace/core/src/actions-queue-executions/domain/services/EntityCandidateFinder.js': {
        EntityCandidateFinder: fakeEntityCandidateFinderCtor,
        NO_PREFILTER: Symbol('NO_PREFILTER'),
    },
    '@kace/core/src/actions-queue-executions/domain/services/CaseContextBatchLoader.js': {
        CaseContextBatchLoader: fakeCaseContextBatchLoaderCtor,
    },
    '@kace/core/src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js': {
        ActionConditionsToSqlTranslator: fakeActionConditionsToSqlTranslatorCtor,
    },
    '@kace/core/src/actions/domain/QueryTranslator/FieldCatalog.js': {
        createCasesFieldCatalog: jest.fn(() => ({})),
    },
    '@kace/core/src/actions/domain/services/FinderByTrigger.js': { FinderByTrigger: jest.fn() },
    '@kace/core/src/automation-settings/domain/AutomationValidationService.js': {
        AutomationValidationService: jest.fn(),
    },
    '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js': {
        KnexAutomationSettingsRepository: jest.fn(),
    },
    '@kace/core/src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js': {
        KnexBackgroundExecutionRepository: jest.fn(),
    },
    '@kace/core/src/cases/index.js': { KnexCaseRepository: jest.fn() },
    '@kace/core/src/grupos/index.js': { KnexGroupsRepository: jest.fn() },
    '@kace/core/src/user-lists/infrastructure/persistence/KnexUserListsRepository.js': {
        KnexUserListsRepository: jest.fn(),
    },
    '@kace/core/src/users/index.js': { KnexUsersRepository: jest.fn() },
    '@kace/core/src/global-config/infrastructure/persistence/KnexGlobalConfigurationRepository.js': {
        KnexGlobalConfigurationRepository: jest.fn(),
    },
    '@kace/core/src/classifications/index.js': { KnexClassificationRepository: jest.fn() },
    '@kace/core/src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js': {
        KnexAuxCasesRepository: jest.fn(),
    },
    '@kace/core/src/shared/domain/services/CaseActionValidator.js': { CaseActionValidator: jest.fn() },
    '@kace/core/src/shared/assignation/AssignationService.js': { AssignationService: jest.fn() },
    '@kace/core/src/actions/domain/types/AssignGroupByExternalDynamicCode.js': {
        AssignGroupByExternalDynamicCode: jest.fn(),
    },
    '@kace/core/src/shared/domain/services/background-execution/BackgroundExecutionService.js': {
        BackgroundExecutionService: jest.fn(),
    },
};
for (const [path, exports] of Object.entries(mockExports)) {
    jest.unstable_mockModule(path, () => exports);
}

const { AutomatedAssignmentJob } = await import('../../src/jobs/AutomatedAssignmentJob.mjs');

describe('AutomatedAssignmentJob', () => {
    beforeEach(() => {
        fakeKnexInstance.destroy.mockClear();
        fakeKnexInstance.destroy.mockResolvedValue(undefined);
        fakeExecute.mockClear();
        fakeExecute.mockResolvedValue({ assigned: 3, skipped: 0, errors: 0, noActions: false });
        fakeLogError.mockClear();
        fakeAutomatedGroupAssignmentServiceCtor.mockClear();
        fakeLegacyAutomatedGroupAssignmentServiceCtor.mockClear();
        fakeEntityCandidateFinderCtor.mockClear();
        fakeCaseContextBatchLoaderCtor.mockClear();
        fakeActionConditionsToSqlTranslatorCtor.mockClear();
        mockRunObserver.recordStart.mockClear();
        mockRunObserver.recordError.mockClear();
        mockRunObserver.persist.mockClear();
        mockRunObserver.persist.mockResolvedValue(null);
        mockRunsRepository.purgeOlderThan.mockClear();
        mockRunsRepository.purgeOlderThan.mockResolvedValue(0);
    });

    it('name is AutomatedAssignmentJob', () => {
        expect(new AutomatedAssignmentJob().name).toBe('AutomatedAssignmentJob');
    });

    it('runs and destroys Knex on success', async () => {
        const result = await new AutomatedAssignmentJob().run({ id: { value: 't-1' } });

        expect(fakeExecute).toHaveBeenCalledTimes(1);
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ assigned: 3, skipped: 0, errors: 0, noActions: false });
    });

    it('destroys Knex even on failure', async () => {
        fakeExecute.mockRejectedValueOnce(new Error('boom'));

        await expect(new AutomatedAssignmentJob().run({ id: { value: 't-2' } })).rejects.toThrow('boom');
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('logs destroy failure without masking the original executor error', async () => {
        fakeExecute.mockRejectedValueOnce(new Error('executor failed'));
        fakeKnexInstance.destroy.mockRejectedValueOnce(new Error('pool stuck'));

        await expect(new AutomatedAssignmentJob().run({ id: { value: 't-3' } })).rejects.toThrow('executor failed');
        expect(fakeKnexInstance.destroy).toHaveBeenCalledTimes(1);
        expect(fakeLogError).toHaveBeenCalledWith(
            'AutomatedAssignmentJob.destroy.failed',
            expect.objectContaining({
                tenantId: 't-3',
                err: 'pool stuck',
                originalErr: 'executor failed',
            })
        );
    });

    it('records the run start, persists it and purges runs older than 7 days on success', async () => {
        await new AutomatedAssignmentJob().run({ id: { value: 't-obs' } });

        expect(mockRunObserver.recordStart).toHaveBeenCalledTimes(1);
        expect(mockRunObserver.persist).toHaveBeenCalledTimes(1);
        expect(mockRunsRepository.purgeOlderThan).toHaveBeenCalledWith(7);
    });

    it('records the error and still persists and purges when the executor fails', async () => {
        const executorError = new Error('boom');
        fakeExecute.mockRejectedValueOnce(executorError);

        await expect(new AutomatedAssignmentJob().run({ id: { value: 't-obs-err' } })).rejects.toThrow('boom');
        expect(mockRunObserver.recordError).toHaveBeenCalledWith(executorError);
        expect(mockRunObserver.persist).toHaveBeenCalledTimes(1);
        expect(mockRunsRepository.purgeOlderThan).toHaveBeenCalledWith(7);
    });
});

describe('AutomatedAssignmentJob — feature flag wiring', () => {
    beforeEach(() => {
        delete process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED;
        fakeKnexInstance.destroy.mockClear();
        fakeKnexInstance.destroy.mockResolvedValue(undefined);
        fakeExecute.mockClear();
        fakeExecute.mockResolvedValue({ assigned: 0, skipped: 0, errors: 0, noActions: true });
        fakeLogError.mockClear();
        fakeAutomatedGroupAssignmentServiceCtor.mockClear();
        fakeLegacyAutomatedGroupAssignmentServiceCtor.mockClear();
        fakeEntityCandidateFinderCtor.mockClear();
        fakeCaseContextBatchLoaderCtor.mockClear();
        fakeActionConditionsToSqlTranslatorCtor.mockClear();
        mockRunObserver.recordStart.mockClear();
        mockRunObserver.recordError.mockClear();
        mockRunObserver.persist.mockClear();
        mockRunObserver.persist.mockResolvedValue(null);
        mockRunsRepository.purgeOlderThan.mockClear();
        mockRunsRepository.purgeOlderThan.mockResolvedValue(0);
    });

    afterAll(() => {
        delete process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED;
    });

    it('uses LegacyAutomatedGroupAssignmentService when flag is unset', async () => {
        const result = await new AutomatedAssignmentJob().run({ id: { value: 't-legacy' } });

        expect(fakeKnexInstance.destroy).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(fakeLegacyAutomatedGroupAssignmentServiceCtor).toHaveBeenCalledTimes(1);
        expect(fakeAutomatedGroupAssignmentServiceCtor).not.toHaveBeenCalled();
        expect(fakeEntityCandidateFinderCtor).not.toHaveBeenCalled();
        expect(fakeCaseContextBatchLoaderCtor).not.toHaveBeenCalled();
    });

    it('uses AutomatedGroupAssignmentService with SQL collaborators when flag is true', async () => {
        process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED = 'true';

        const result = await new AutomatedAssignmentJob().run({ id: { value: 't-new' } });

        expect(fakeKnexInstance.destroy).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(fakeAutomatedGroupAssignmentServiceCtor).toHaveBeenCalledTimes(1);
        expect(fakeLegacyAutomatedGroupAssignmentServiceCtor).not.toHaveBeenCalled();
        expect(fakeEntityCandidateFinderCtor).toHaveBeenCalledTimes(1);
        expect(fakeCaseContextBatchLoaderCtor).toHaveBeenCalledTimes(1);
        expect(fakeActionConditionsToSqlTranslatorCtor).toHaveBeenCalledTimes(1);

        const ctorDeps = fakeAutomatedGroupAssignmentServiceCtor.mock.calls[0][1];
        expect(ctorDeps).toEqual(
            expect.objectContaining({
                caseCandidateFinder: expect.anything(),
                caseContextBatchLoader: expect.anything(),
            })
        );
    });

    it('wires the backlog snapshots repository into the SQL-prefilter assignment service', async () => {
        const previous = process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED;
        process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED = 'true';
        try {
            await new AutomatedAssignmentJob().run({ id: { value: 't-9' } });
            expect(fakeAutomatedGroupAssignmentServiceCtor).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ backlogSnapshotsRepository: expect.anything() })
            );
        } finally {
            process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED = previous;
        }
    });
});
