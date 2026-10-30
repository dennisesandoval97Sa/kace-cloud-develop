import { ActionQueueExecutionsExecutor } from '../../src/actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js';
import { AutomatedActionsRequested } from '../../src/actions-queue-executions/domain/events/AutomatedActionsRequested.js';
import { ActionsProcessor } from '../../src/actions-queue-executions/domain/services/ActionsProcessor.js';
import { LegacyCasesProcessor } from '../../src/actions-queue-executions/domain/services/LegacyCasesProcessor.js';
import { FailedOperationsHandler } from '../../src/actions-queue-executions/domain/services/FailedOperationsHandler.js';
import { ActionTriggers } from '../../src/shared/domain/enum/ActionTriggersEnum.js';
import { jest } from '@jest/globals';
import Knex from 'knex';
import { Helper } from '../../src/shared/index.js';
import { EventLogger } from '../../src/shared/EventLogger.js';

describe('ActionQueueExecutionsExecutor publish behavior', () => {
    let repository;
    let backgroundExecutionRepository;
    let mockAction;
    let mockCase;

    beforeEach(() => {
        mockAction = {
            id: { value: '00000000-0000-4000-8000-000000000001' },
        };

        mockCase = {
            id: { value: '00000000-0000-4000-8000-000000000002' },
            cliente_id: { value: '00000000-0000-4000-8000-000000000003' },
        };

        repository = {
            findByFilters: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockResolvedValue(undefined),
            connection: Knex({
                client: 'pg',
                connection: {
                    filename: ':memory:',
                },
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

        // The executor uses LegacyCasesProcessor when ACTION_QUEUE_SQL_PREFILTER_ENABLED is not 'true'
        jest.spyOn(LegacyCasesProcessor.prototype, 'loadActiveCases').mockResolvedValue(undefined);
        jest.spyOn(LegacyCasesProcessor.prototype, 'processCasesWithActions').mockResolvedValue(undefined);
        jest.spyOn(LegacyCasesProcessor.prototype, 'getErrorOperations').mockReturnValue([]);
        jest.spyOn(LegacyCasesProcessor.prototype, 'getSuccessOperations').mockReturnValue([
            { action: mockAction, case: mockCase },
        ]);
        jest.spyOn(LegacyCasesProcessor.prototype, 'getFailedOperations').mockReturnValue([]);
        jest.spyOn(LegacyCasesProcessor.prototype, 'reset').mockImplementation(() => {});

        jest.spyOn(FailedOperationsHandler.prototype, 'retry').mockResolvedValue({
            success: [],
            failed: [],
        });
    });

    afterEach(async () => {
        await repository.connection.destroy();
        jest.restoreAllMocks();
    });

    function createExecutor(eventPublisher) {
        // constructor: repository, actionRepository, caseRepository, backgroundExecutionRepository,
        //              automationSettingsRepository, groupsRepository, userListsRepository, eventPublisher, tenant
        const tenant = { id: { value: '00000000-0000-4000-8000-000000000099' } };
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

    it('should publish kace.core.automated_actions.requested after persistence', async () => {
        const eventPublisher = {
            publishAll: jest.fn().mockResolvedValue({ successful: 1, failed: 0, failedAggregateIds: [] }),
        };

        const executor = createExecutor(eventPublisher);
        const result = await executor.execute();
        const response = result.toJson();

        expect(response.data.successful).toBe(1);
        expect(repository.save).toHaveBeenCalledTimes(1);
        expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);

        const events = eventPublisher.publishAll.mock.calls[0][0];
        expect(events).toHaveLength(1);
        const event = events[0];
        expect(event).toBeInstanceOf(AutomatedActionsRequested);
        expect(event.eventName).toBe(AutomatedActionsRequested.EVENT_NAME);
        expect(event.payload.executionId).toBeDefined();
        expect(event.payload.actionId).toBe(mockAction.id.value);
        expect(event.payload.caseId).toBe(mockCase.id.value);
        expect(event.payload.clientId).toBe(mockCase.cliente_id.value);
        expect(event.payload.triggerType).toBe(ActionTriggers.CRON_JOB.value);
    });

    it('should preserve backward compatibility when eventPublisher is not provided', async () => {
        const executor = createExecutor(undefined);
        const result = await executor.execute();
        const response = result.toJson();

        expect(response.data.successful).toBe(1);
        expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('should keep main flow running when event publish fails', async () => {
        const eventPublisher = {
            publishAll: jest.fn().mockRejectedValue(new Error('event bus unavailable')),
        };

        const logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const eventLoggerSpy = jest.spyOn(EventLogger.prototype, 'log').mockResolvedValue(undefined);

        const executor = createExecutor(eventPublisher);
        const result = await executor.execute();
        const response = result.toJson();

        expect(response.data.successful).toBe(1);
        expect(response.data.failed).toBe(1);
        expect(repository.save).toHaveBeenCalledTimes(1);
        expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);
        expect(logErrorSpy).toHaveBeenCalled();
        expect(eventLoggerSpy).toHaveBeenCalledWith(
            'action-queue-execution.error',
            expect.any(String),
            null,
            expect.objectContaining({
                stage: 'event_publishing',
                total_failed: 1,
            })
        );
    });

    it('should aggregate publish failures while keeping all successful persists', async () => {
        const secondAction = {
            id: { value: '00000000-0000-4000-8000-000000000010' },
        };
        const secondCase = {
            id: { value: '00000000-0000-4000-8000-000000000011' },
            cliente_id: { value: '00000000-0000-4000-8000-000000000012' },
        };

        jest.spyOn(LegacyCasesProcessor.prototype, 'getSuccessOperations').mockReturnValue([
            { action: mockAction, case: mockCase },
            { action: secondAction, case: secondCase },
        ]);

        // publishAll succeeds at transport level but reports one per-entry failure
        // back via failedAggregateIds (the second event's executionId/aggregateId).
        const eventPublisher = {
            publishAll: jest.fn(async (events) => ({
                successful: events.length - 1,
                failed: 1,
                failedAggregateIds: [events[1].aggregateId],
            })),
        };

        const eventLoggerSpy = jest.spyOn(EventLogger.prototype, 'log').mockResolvedValue(undefined);

        const executor = createExecutor(eventPublisher);
        const result = await executor.execute();
        const response = result.toJson();

        expect(response.data.successful).toBe(2);
        expect(response.data.failed).toBe(1);
        expect(repository.save).toHaveBeenCalledTimes(2);
        expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);
        expect(eventLoggerSpy).toHaveBeenCalledWith(
            'action-queue-execution.error',
            expect.any(String),
            null,
            expect.objectContaining({
                stage: 'event_publishing',
                total_failed: 1,
            })
        );
    });
});
