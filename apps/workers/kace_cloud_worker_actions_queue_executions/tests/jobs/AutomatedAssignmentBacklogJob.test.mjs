import { jest } from '@jest/globals';

const writerDb = { name: 'writer', destroy: jest.fn().mockResolvedValue(undefined) };
const readerDb = { name: 'reader', destroy: jest.fn().mockResolvedValue(undefined) };
const fakeKnexFactory = jest.fn((config) => (config.role === 'reader' ? readerDb : writerDb));
jest.unstable_mockModule('knex', () => ({ default: fakeKnexFactory }));

const buildKnexConfig = jest.fn(() => ({ role: 'writer', connection: { host: 'primary' } }));
const buildReaderConfig = jest.fn(() => ({ role: 'reader', connection: { host: 'replica' } }));
jest.unstable_mockModule('@kace/api-common', () => ({
    TenantContextManager: { buildKnexConfig, buildReaderConfig },
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: {
        logError: jest.fn(),
        logInfo: jest.fn(),
        logDebug: jest.fn(),
        logTime: jest.fn(),
        logTimeEnd: jest.fn(),
    },
}));

const refresherExecute = jest.fn().mockResolvedValue({ counted: 18, skipped: 0, failed: 0, removed: 0 });
const RefresherCtor = jest.fn(() => ({ execute: refresherExecute }));
const SnapshotsRepoCtor = jest.fn();
const CaseRepoCtor = jest.fn();
const ActionRepoCtor = jest.fn();
const SettingsRepoCtor = jest.fn();
const FinderCtor = jest.fn();
const ValidationCtor = jest.fn();

const mockExports = {
    '@kace/core/src/automated-assignment-runs/application/backlog-snapshots/ActionBacklogSnapshotRefresher.js': {
        ActionBacklogSnapshotRefresher: RefresherCtor,
    },
    '@kace/core/src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentBacklogSnapshotsRepository.js':
        { KnexAutomatedAssignmentBacklogSnapshotsRepository: SnapshotsRepoCtor },
    '@kace/core/src/cases/index.js': { KnexCaseRepository: CaseRepoCtor },
    '@kace/core/src/actions/index.js': { KnexActionRepository: ActionRepoCtor },
    '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js': {
        KnexAutomationSettingsRepository: SettingsRepoCtor,
    },
    '@kace/core/src/actions/domain/services/FinderByTrigger.js': { FinderByTrigger: jest.fn() },
    '@kace/core/src/automation-settings/domain/AutomationValidationService.js': {
        AutomationValidationService: ValidationCtor,
    },
    '@kace/core/src/actions-queue-executions/domain/services/ActionsProcessor.js': { ActionsProcessor: jest.fn() },
    '@kace/core/src/actions-queue-executions/domain/services/EntityCandidateFinder.js': {
        EntityCandidateFinder: FinderCtor,
    },
    '@kace/core/src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js': {
        ActionConditionsToSqlTranslator: jest.fn(),
    },
    '@kace/core/src/actions/domain/QueryTranslator/FieldCatalog.js': { createCasesFieldCatalog: jest.fn(() => ({})) },
};
for (const [path, exports] of Object.entries(mockExports)) {
    jest.unstable_mockModule(path, () => exports);
}

const { AutomatedAssignmentBacklogJob } = await import('../../src/jobs/AutomatedAssignmentBacklogJob.mjs');

const tenant = { id: { value: 't-1' } };

describe('AutomatedAssignmentBacklogJob', () => {
    const original = process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED = 'true';
        refresherExecute.mockResolvedValue({ counted: 18, skipped: 0, failed: 0, removed: 0 });
        writerDb.destroy.mockResolvedValue(undefined);
        readerDb.destroy.mockResolvedValue(undefined);
    });
    afterAll(() => {
        process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED = original;
    });

    it('name is AutomatedAssignmentBacklogJob', () => {
        expect(new AutomatedAssignmentBacklogJob().name).toBe('AutomatedAssignmentBacklogJob');
    });

    const passedConfig = (role) => fakeKnexFactory.mock.calls.map(([c]) => c).find((c) => c.role === role);

    it('asks for the replica explicitly', async () => {
        await new AutomatedAssignmentBacklogJob().run(tenant);

        expect(buildReaderConfig).toHaveBeenCalledWith(tenant, expect.objectContaining({ preferReplica: true }));
        expect(passedConfig('reader').connection.host).toBe('replica');
    });

    // A session SET (e.g. statement_timeout) pins RDS Proxy connections: the reader config goes as is.
    it('passes the reader config untouched', async () => {
        const readerConfig = { role: 'reader', connection: { host: 'replica' }, pool: { max: 2 } };
        buildReaderConfig.mockReturnValueOnce(readerConfig);
        await new AutomatedAssignmentBacklogJob().run(tenant);

        expect(passedConfig('reader')).toBe(readerConfig);
    });

    it('leaves the writer pool untouched', async () => {
        await new AutomatedAssignmentBacklogJob().run(tenant);

        expect(passedConfig('writer')).toEqual({ role: 'writer', connection: { host: 'primary' } });
    });

    it('reads through the replica and writes snapshots through the primary', async () => {
        await new AutomatedAssignmentBacklogJob().run(tenant);

        expect(CaseRepoCtor).toHaveBeenCalledWith(readerDb);
        expect(ActionRepoCtor).toHaveBeenCalledWith(readerDb);
        expect(SettingsRepoCtor).toHaveBeenCalledWith(readerDb);
        expect(SnapshotsRepoCtor).toHaveBeenCalledWith(writerDb);
        expect(refresherExecute).toHaveBeenCalledTimes(1);
    });

    it('gives the refresher the automation validation built on the replica', async () => {
        await new AutomatedAssignmentBacklogJob().run(tenant);

        const [validation] = ValidationCtor.mock.instances;
        expect(ValidationCtor).toHaveBeenCalledWith(SettingsRepoCtor.mock.instances[0]);
        expect(RefresherCtor).toHaveBeenCalledWith(expect.objectContaining({ automationValidation: validation }));
    });

    it('destroys both pools on success and on failure', async () => {
        await new AutomatedAssignmentBacklogJob().run(tenant);
        expect(readerDb.destroy).toHaveBeenCalledTimes(1);
        expect(writerDb.destroy).toHaveBeenCalledTimes(1);

        refresherExecute.mockRejectedValueOnce(new Error('replica down'));
        await expect(new AutomatedAssignmentBacklogJob().run(tenant)).rejects.toThrow('replica down');
        expect(readerDb.destroy).toHaveBeenCalledTimes(2);
        expect(writerDb.destroy).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the SQL prefilter is disabled (legacy mode)', async () => {
        process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED = 'false';

        await expect(new AutomatedAssignmentBacklogJob().run(tenant)).resolves.toBeNull();
        expect(fakeKnexFactory).not.toHaveBeenCalled();
        expect(refresherExecute).not.toHaveBeenCalled();
    });
});
