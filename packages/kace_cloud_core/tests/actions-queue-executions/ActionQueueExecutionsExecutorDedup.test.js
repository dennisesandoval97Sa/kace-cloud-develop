import { ActionQueueExecutionsExecutor } from '../../src/actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js';
import { AutomatedActionsRequested } from '../../src/actions-queue-executions/domain/events/AutomatedActionsRequested.js';
import { ActionsProcessor } from '../../src/actions-queue-executions/domain/services/ActionsProcessor.js';
import { LegacyCasesProcessor } from '../../src/actions-queue-executions/domain/services/LegacyCasesProcessor.js';
import { FailedOperationsHandler } from '../../src/actions-queue-executions/domain/services/FailedOperationsHandler.js';
import { jest } from '@jest/globals';
import Knex from 'knex';

/**
 * Verifies that the in-memory Set (#enqueuedThisRun) prevents the same
 * (action_id, case_id) pair from being inserted more than once within a single
 * execute() call. The repository mock accepts every save() unconditionally — all
 * deduplication logic lives in the executor.
 */
describe('ActionQueueExecutionsExecutor dedup behavior (in-memory Set)', () => {
    let repository;
    let backgroundExecutionRepository;
    let mockAction;
    let mockCase;
    let mockCase2;

    const tenant = { id: { value: '00000000-0000-4000-8000-000000000099' } };

    beforeEach(() => {
        mockAction = { id: { value: '00000000-0000-4000-8000-000000000001' } };
        mockCase = {
            id: { value: '00000000-0000-4000-8000-000000000002' },
            cliente_id: { value: '00000000-0000-4000-8000-000000000003' },
        };
        mockCase2 = {
            id: { value: '00000000-0000-4000-8000-000000000004' },
            cliente_id: { value: '00000000-0000-4000-8000-000000000003' },
        };

        repository = {
            findByFilters: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockResolvedValue(undefined),
            connection: Knex({
                client: 'pg',
                connection: { filename: ':memory:' },
            }),
        };

        backgroundExecutionRepository = {
            findByProcess: jest.fn().mockResolvedValue({
                execution_status: { value: false },
                update: jest.fn(),
                flushChanges: jest.fn(),
            }),
            update: jest.fn().mockResolvedValue(undefined),
        };

        jest.spyOn(ActionsProcessor.prototype, 'isAlreadyRunning').mockResolvedValue(false);
        jest.spyOn(ActionsProcessor.prototype, 'findActionsIfEligible').mockResolvedValue([mockAction]);
        jest.spyOn(ActionsProcessor.prototype, 'process').mockResolvedValue(undefined);
        jest.spyOn(ActionsProcessor.prototype, 'getStandardActions').mockReturnValue([mockAction]);
        jest.spyOn(ActionsProcessor.prototype, 'getProcessedActions').mockReturnValue([]);
        jest.spyOn(ActionsProcessor.prototype, 'clearProcessedActions').mockImplementation(() => {});

        jest.spyOn(LegacyCasesProcessor.prototype, 'loadActiveCases').mockResolvedValue(undefined);
        jest.spyOn(LegacyCasesProcessor.prototype, 'processCasesWithActions').mockResolvedValue(undefined);
        jest.spyOn(LegacyCasesProcessor.prototype, 'getErrorOperations').mockReturnValue([]);
        jest.spyOn(LegacyCasesProcessor.prototype, 'getSuccessOperations').mockReturnValue([
            { action: mockAction, case: mockCase },
        ]);
        jest.spyOn(LegacyCasesProcessor.prototype, 'getFailedOperations').mockReturnValue([]);
        jest.spyOn(LegacyCasesProcessor.prototype, 'reset').mockImplementation(() => {});

        jest.spyOn(FailedOperationsHandler.prototype, 'retry').mockResolvedValue({ success: [], failed: [] });
    });

    afterEach(async () => {
        await repository.connection.destroy();
        jest.restoreAllMocks();
    });

    function createExecutor(eventPublisher) {
        return new ActionQueueExecutionsExecutor(
            repository,
            {},
            {},
            backgroundExecutionRepository,
            {},
            {},
            {},
            eventPublisher,
            tenant
        );
    }

    it('par repetido en el mismo batch: solo un INSERT, duplicate=1', async () => {
        jest.spyOn(LegacyCasesProcessor.prototype, 'getSuccessOperations').mockReturnValue([
            { action: mockAction, case: mockCase },
            { action: mockAction, case: mockCase },
        ]);

        const eventPublisher = { publishAll: jest.fn().mockResolvedValue({ failedAggregateIds: [] }) };
        const executor = createExecutor(eventPublisher);

        const response = (await executor.execute()).toJson();

        expect(response.data.successful).toBe(1);
        expect(response.data.duplicate).toBe(1);
        expect(repository.save).toHaveBeenCalledTimes(1);
        // El ejecutor publica un lote por tanda persistida, no un evento por par.
        expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);
        const [events] = eventPublisher.publishAll.mock.calls[0];
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(AutomatedActionsRequested);
        expect(events[0].payload.caseId).toBe(mockCase.id.value);
    });

    it('par repetido entre successOps y retryResults: solo un INSERT total', async () => {
        jest.spyOn(FailedOperationsHandler.prototype, 'retry').mockResolvedValue({
            success: [{ action: mockAction, case: mockCase }],
            failed: [],
        });

        const eventPublisher = { publishAll: jest.fn().mockResolvedValue({ failedAggregateIds: [] }) };
        const executor = createExecutor(eventPublisher);

        const response = (await executor.execute()).toJson();

        expect(response.data.successful).toBe(1);
        expect(response.data.duplicate).toBe(1);
        expect(repository.save).toHaveBeenCalledTimes(1);
        expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);
        expect(eventPublisher.publishAll.mock.calls[0][0]).toHaveLength(1);
    });

    it('pares distintos: todos se insertan, duplicate=0', async () => {
        jest.spyOn(LegacyCasesProcessor.prototype, 'getSuccessOperations').mockReturnValue([
            { action: mockAction, case: mockCase },
            { action: mockAction, case: mockCase2 },
        ]);

        const eventPublisher = { publishAll: jest.fn().mockResolvedValue({ failedAggregateIds: [] }) };
        const executor = createExecutor(eventPublisher);

        const response = (await executor.execute()).toJson();

        expect(response.data.successful).toBe(2);
        expect(response.data.duplicate).toBe(0);
        expect(repository.save).toHaveBeenCalledTimes(2);
        expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);
        expect(eventPublisher.publishAll.mock.calls[0][0]).toHaveLength(2);
    });

    it('el Set se resetea entre ejecuciones: cada execute() puede insertar el mismo par', async () => {
        const eventPublisher = { publishAll: jest.fn().mockResolvedValue({ failedAggregateIds: [] }) };
        const executor = createExecutor(eventPublisher);

        const first = (await executor.execute()).toJson();
        const second = (await executor.execute()).toJson();

        expect(first.data.successful).toBe(1);
        expect(first.data.duplicate).toBe(0);
        expect(second.data.successful).toBe(1);
        expect(second.data.duplicate).toBe(0);
        expect(repository.save).toHaveBeenCalledTimes(2);
    });
});
