import { ActionTriggers } from '../../../shared/domain/enum/ActionTriggersEnum.js';
import { ActionsQueueExecutions } from '../../domain/ActionsQueueExecutions.js';
import { v4 as uuidv4 } from 'uuid';
import { StatusEnum } from '../../domain/enum/StatusEnum.js';
import { ActionQueueExecutionsExecutorResponse } from './ActionQueueExecutionsExecutorResponse.js';
import { CaseActionValidator } from '../../../shared/domain/services/CaseActionValidator.js';
import { GroupsFinder } from '../../../grupos/domain/GroupsFinder.js';
import { GroupAssignmentPlanner } from '../../domain/services/GroupAssignmentPlanner.js';
import { ActionsProcessor } from '../../domain/services/ActionsProcessor.js';
import { CasesProcessor } from '../../domain/services/CasesProcessor.js';
import { LegacyCasesProcessor } from '../../domain/services/LegacyCasesProcessor.js';
import { EntityCandidateFinder } from '../../domain/services/EntityCandidateFinder.js';
import { CaseContextBatchLoader } from '../../domain/services/CaseContextBatchLoader.js';
import { ActionConditionsToSqlTranslator } from '../../../actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createCasesFieldCatalog } from '../../../actions/domain/QueryTranslator/FieldCatalog.js';
import { FailedOperationsHandler } from '../../domain/services/FailedOperationsHandler.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { BackgroundProcessEnum } from '../../../shared/domain/enum/BackgroundProcessEnum.js';
import { Parameters } from '../../../shared/domain/params/Parameters.js';
import { BackgroundExecutionService } from '../../../shared/domain/services/background-execution/BackgroundExecutionService.js';
import { CaseFindAllActiveService } from '../../../cases/domain/services/CaseFindAllActiveService.js';
import { FinderByTrigger } from '../../../actions/domain/services/FinderByTrigger.js';
import { AutomationValidationService } from '../../../automation-settings/domain/AutomationValidationService.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { ErrorCollector } from '../../../shared/errors/ErrorCollector.js';
import { AutomatedActionsRequested } from '../../domain/events/AutomatedActionsRequested.js';
import { ActionTypes } from '../../../actions/domain/ActionTypes.js';
export class ActionQueueExecutionsExecutor {
    #DUPLICATE = 0;
    #SUCCESS = 0;
    #EVENT_PUBLISH_FAILED = 0;
    #enqueuedThisRun = new Set();

    /** @type {GroupsFinder} */
    #groupsFinder;

    /** @type {GroupAssignmentPlanner} */
    #groupAssignmentPlanner;

    /** @type {Array<Object>} */
    #workQueueCapacityContext = [];
    /**
     * @type {KnexActionsQueueExecutionsRepository}
     */
    #repository;
    /**
     * @type {BackgroundExecutionService}
     */
    #backgroundExecutionService;
    /**
     * @type {ActionsProcessor}
     */
    #actionsProcessor;
    /**
     * @type {CasesProcessor}
     */
    #casesProcessor;
    /**
     * @type {FailedOperationsHandler}
     */
    #failedHandler;
    /**
     * @type {EventLogger}
     */
    #eventLogger;
    /** @type {import('../../../shared/application/events/EventPublisher.js').EventPublisher|null} */
    #eventPublisher;

    /** @type {Tenant} */
    #tenant;

    /**
     * @param {KnexActionsQueueExecutionsRepository} repository - Repository to persist ActionsQueueExecutions.
     * @param {KnexActionRepository} actionRepository - Repository to retrieve and validate actions.
     * @param {KnexCaseRepository} caseRepository - Repository to retrieve cases.
     * @param {KnexBackgroundExecutionRepository} backgroundExecutionRepository
     * @param {KnexAutomationSettingsRepository} automationSettingsRepository
     * @param {import('../../../shared/application/events/EventPublisher.js').EventPublisher} [eventPublisher]
     * @param {Tenant} tenant
     */
    constructor(
        repository,
        actionRepository,
        caseRepository,
        backgroundExecutionRepository,
        automationSettingsRepository,
        groupsRepository,
        userListsRepository,
        eventPublisher,
        tenant
    ) {
        this.#repository = repository;
        this.#tenant = tenant;
        this.#groupsFinder = new GroupsFinder(groupsRepository);

        const caseActionValidator = new CaseActionValidator(actionRepository);
        const caseFindAllActiveService = new CaseFindAllActiveService(caseRepository);

        const useSqlPrefilter = process.env.ACTION_QUEUE_SQL_PREFILTER_ENABLED === 'true';

        if (useSqlPrefilter) {
            const candidateFinder = new EntityCandidateFinder({
                entityRepository: caseRepository,
                translator: new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog() }),
                buildBaseQuery: (conn, t, qualify = (x) => x) =>
                    conn(qualify(t)).select(`${t}.id`).whereNull(`${t}.fecha_resolucion`),
            });
            const contextLoader = new CaseContextBatchLoader(caseRepository);
            this.#casesProcessor = new CasesProcessor(
                caseFindAllActiveService,
                caseActionValidator,
                candidateFinder,
                contextLoader
            );
        } else {
            this.#casesProcessor = new LegacyCasesProcessor(caseFindAllActiveService, caseActionValidator);
        }

        this.#groupAssignmentPlanner = new GroupAssignmentPlanner(caseActionValidator, {
            userListsRepository,
            groupsRepository,
            caseFindAllActiveService,
        });

        this.#backgroundExecutionService = new BackgroundExecutionService(backgroundExecutionRepository);

        this.#actionsProcessor = new ActionsProcessor(
            new FinderByTrigger(actionRepository),
            new AutomationValidationService(automationSettingsRepository)
        );

        this.#failedHandler = new FailedOperationsHandler(caseActionValidator);
        this.#eventLogger = new EventLogger(repository);
        this.#eventPublisher = eventPublisher || null;
    }
    /**
     * Executes the complete queue processing flow:
     * 1. Finds and processes eligible actions.
     * 2. Loads and processes active cases.
     * 3. Persists successful action-case executions.
     * 4. Retries failed operations and persists any successful retries.
     * 5. Returns a summary response.
     *
     * @returns {Promise<ActionQueueExecutionsExecutorResponse>} Summary of the execution result.
     */
    async execute() {
        let response;
        try {
            this.#SUCCESS = 0;
            this.#DUPLICATE = 0;
            this.#EVENT_PUBLISH_FAILED = 0;
            this.#enqueuedThisRun = new Set();

            Helper.logDebug('ActionQueueExecutionsExecutor.start');

            if (await this.#actionsProcessor.isAlreadyRunning(this.#backgroundExecutionService)) {
                Helper.logDebug('ActionQueueExecutionsExecutor.skipped', { reason: 'already_running' });
                return new ActionQueueExecutionsExecutorResponse(this.#createSkipResult('already_running'));
            }
            await this.#markBackgroundProcess(true);

            const foundActions = await this.#actionsProcessor.findActionsIfEligible({
                actionTypeFilter: {
                    exclude: [...ActionTypes.GROUP_ASSIGNMENT_TYPES],
                },
                service: 'ActionQueueExecutionsExecutor',
            });
            Helper.logDebug(`ActionQueueExecutionsExecutor::foundActions: ${foundActions?.length}`);
            const foundCount = foundActions?.length ?? 0;
            if (foundCount > 0) {
                Helper.logInfo('ActionQueueExecutionsExecutor.actionsFound', { count: foundCount });
            } else {
                Helper.logDebug('ActionQueueExecutionsExecutor.actionsFound', { count: 0 });
            }
            if (foundActions) {
                await this.#actionsProcessor.process(foundActions);
            }

            if (this.#casesProcessor instanceof LegacyCasesProcessor) {
                await this.#casesProcessor.loadActiveCases();
                Helper.logDebug(
                    `ActionsQueueExecutionsExecutor::activeCasesLoaded count=${this.#casesProcessor.getActiveCases().length}`
                );
            } else {
                Helper.logDebug('ActionsQueueExecutionsExecutor::sql-prefilter enabled; cases loaded per-candidate');
            }

            const standardActions = this.#actionsProcessor.getStandardActions();
            if (standardActions.length > 0) {
                await this.#casesProcessor.processCasesWithActions(standardActions);
            }

            if (typeof this.#casesProcessor.getMetrics === 'function') {
                const metrics = this.#casesProcessor.getMetrics();
                Helper.logDebug('action-queue-execution.metrics', JSON.stringify(metrics));
            }

            const errored = this.#casesProcessor.getErrorOperations();
            const ruleFalse = this.#casesProcessor.getFailedOperations();

            if (errored.length > 0) {
                await this.#logFailedOperations(errored, 'initial_processing');
            }

            await this.#persistValidQueueExecutions(this.#casesProcessor.getSuccessOperations());

            const retryResults = await this.#failedHandler.retry(errored);
            this.#casesProcessor.reset();

            await this.#persistValidQueueExecutions(retryResults.success);

            const retryPayload = {
                retrySuccess: retryResults.success.length,
                retryFailed: retryResults.failed.length,
            };
            if (retryPayload.retrySuccess + retryPayload.retryFailed > 0) {
                Helper.logInfo('ActionQueueExecutionsExecutor.retryDone', retryPayload);
            } else {
                Helper.logDebug('ActionQueueExecutionsExecutor.retryDone', retryPayload);
            }

            response = {
                successful: this.#SUCCESS,
                failed: ruleFalse.length + retryResults.failed.length + this.#EVENT_PUBLISH_FAILED,
                duplicate: this.#DUPLICATE,
            };

            Helper.logDebug(
                `ActionQueueExecutionsExecutor::finalCounters successful=${response.successful}, failed=${response.failed}, duplicate=${response.duplicate}`
            );
            const endPayload = {
                successful: response.successful,
                ruleFalse: ruleFalse.length,
                errored: errored.length,
                retrySuccess: retryResults.success.length,
                retryFailed: retryResults.failed.length,
                duplicate: response.duplicate,
                eventPublishFailed: this.#EVENT_PUBLISH_FAILED,
            };
            const endHasWork =
                endPayload.successful +
                    endPayload.ruleFalse +
                    endPayload.errored +
                    endPayload.retrySuccess +
                    endPayload.retryFailed +
                    endPayload.duplicate >
                0;
            if (endHasWork) {
                Helper.logInfo('ActionQueueExecutionsExecutor.end', endPayload);
            } else {
                Helper.logDebug('ActionQueueExecutionsExecutor.end', endPayload);
            }

            this.#actionsProcessor.clearProcessedActions();

            return new ActionQueueExecutionsExecutorResponse(response);
        } catch (error) {
            Helper.logError('Critical error in action queue execution executor:', error);
            await this.#logCriticalError(error);
            return new ActionQueueExecutionsExecutorResponse(this.#createSkipResult('critical_error'));
        } finally {
            await this.#markBackgroundProcess(false);
        }
    }

    /**
     * Logs failed operations to the event logger
     * @param {Array} failedOps - Array of failed operations
     * @param {string} stage - Stage where the failure occurred
     * @private
     */
    async #logFailedOperations(failedOps, stage) {
        try {
            const errorCollector = new ErrorCollector();
            const details = [];
            failedOps.forEach(({ action, case: caseObj, error }) => {
                details.push({
                    action: {
                        id: action.id.value,
                        description: action.description.value,
                        action_type: action.action_type.value,
                    },
                    case: {
                        id: caseObj.id.value,
                        reference: caseObj.reference.value,
                    },
                    error_type: error.constructor.name,
                });
                const field = `case_for_action`;
                const message = `Failed to process action ${action?.id?.value} for case ${caseObj?.id?.value}`;
                errorCollector.addError(field, message, 'processing');
            });

            const eventBody = {
                stage,
                total_failed: failedOps.length,
                errors: errorCollector.toJSON(),
                details,
            };

            await this.#eventLogger.log('action-queue-execution.error', uuidv4(), null, eventBody);
        } catch (logError) {
            Helper.logError('Error logging failed operations:', logError);
        }
    }

    /**
     * Logs critical errors to the event logger
     * @param {Error} error - The critical error that occurred
     * @private
     */
    async #logCriticalError(error) {
        try {
            const eventBody = {
                stage: 'critical_error',
                error_type: error.constructor.name,
            };

            await this.#eventLogger.log('action-queue-execution.error', uuidv4(), null, eventBody);
        } catch (logError) {
            Helper.logError('Error logging critical error:', logError);
        }
    }

    /**
     * Creates a result object when processing is skipped
     *
     * @param {string} reason - Reason why processing is skipped
     * @returns {Object} Result object with zero counters and skip reason
     */
    #createSkipResult(reason) {
        return {
            successful: 0,
            failed: 0,
            duplicate: 0,
            skipped: true,
            reason,
        };
    }

    /**
     * Marks the execution process according to the provided status
     *
     * @param {Boolean} status - Process status (running or not) -> True for running, false for not running
     *
     * @returns {Promise<void>}
     */
    async #markBackgroundProcess(status) {
        await this.#backgroundExecutionService.updateBackgroundExecution(
            BackgroundProcessEnum.ACTION_QUEUE_EXECUTION.value,
            { execution_status: status }
        );
    }

    /**
     * Persists valid action queue executions if they are not duplicates.
     * @param {Array} successOps - List of successful operations, each containing an action and a case.
     */

    async #persistValidQueueExecutions(successOps) {
        const persistedDtos = [];

        for (const { action, case: caseObj } of successOps) {
            const key = `${action.id.value}:${caseObj.id.value}`;

            if (this.#enqueuedThisRun.has(key)) {
                this.#DUPLICATE++;
                Helper.logDebug('ActionQueueExecutionsExecutor::duplicateSkipped', {
                    action: action.id.value,
                    case: caseObj.id.value,
                });
                continue;
            }

            const dto = this.#buildExecutionDto(action, caseObj);
            Helper.logDebug(
                `ActionQueueExecutionsExecutor::persistValidQueueExecutions: ${dto.id}, action: ${action.id.value}, case: ${caseObj.id.value}`
            );
            await this.#saveExecution(dto);
            this.#enqueuedThisRun.add(key);
            this.#SUCCESS++;
            persistedDtos.push(dto);
        }

        if (persistedDtos.length > 0) {
            await this.#publishAutomatedActionsRequestedBatch(persistedDtos);
        }
    }
    /**
     * Builds a DTO (Data Transfer Object) for an action execution.
     * @param {Object} action - The action object.
     * @param {Object} caseObj - The case object.
     * @returns {Object} DTO containing all necessary execution data.
     */
    #buildExecutionDto(action, caseObj) {
        return {
            id: uuidv4(),
            action_id: action.id.value,
            case_id: caseObj.id.value,
            client_id: caseObj.cliente_id.value,
            status: StatusEnum.PENDING.value,
            trigger_type: ActionTriggers.CRON_JOB.value,
            created_at: new Date().toISOString(),
            created_by: Parameters.defaultUserId,
        };
    }
    /**
     * Creates and saves a new action queue execution.
     * @param {Object} dto - DTO with execution data.
     */
    async #saveExecution(dto) {
        const execution = ActionsQueueExecutions.create(dto);
        await this.#repository.save(execution);
    }

    /**
     * Publishes domain events for persisted executions as a single bounded SQS
     * batch. On a thrown error (transport down) ALL events are counted as failed
     * so none are silently lost; on success only the per-entry failures reported
     * back via `failedAggregateIds` are reconciled into the failure counter.
     * @param {Array<Object>} persistedDtos
     */
    async #publishAutomatedActionsRequestedBatch(persistedDtos) {
        if (!this.#eventPublisher) {
            Helper.logDebug('Event publisher is not available, skipping automated actions requested publishing');
            return;
        }

        const events = persistedDtos.map((dto) => ({
            dto,
            event: new AutomatedActionsRequested({
                executionId: dto.id,
                actionId: dto.action_id,
                caseId: dto.case_id,
                clientId: dto.client_id,
                triggerType: dto.trigger_type,
                metadata: {
                    user_id: dto.created_by,
                    correlation_id: dto.id,
                    tenant_id: this.#tenant.id.value,
                },
            }),
        }));

        let result;
        try {
            result = await this.#eventPublisher.publishAll(events.map(({ event }) => event));
        } catch (error) {
            const errorMessage = error?.message || error;
            const failedPublishes = events.map(({ dto }) => ({
                executionId: dto.id,
                actionId: dto.action_id,
                caseId: dto.case_id,
                error: errorMessage,
            }));

            Helper.logError('Failed to publish AutomatedActionsRequested batch', {
                count: events.length,
                error: errorMessage,
            });

            this.#EVENT_PUBLISH_FAILED += failedPublishes.length;
            await this.#logEventPublishFailures(failedPublishes);
            return;
        }

        const failedAggregateIds = new Set(result?.failedAggregateIds ?? []);
        if (failedAggregateIds.size === 0) {
            return;
        }

        const failedPublishes = events
            .filter(({ dto }) => failedAggregateIds.has(dto.id))
            .map(({ dto }) => ({
                executionId: dto.id,
                actionId: dto.action_id,
                caseId: dto.case_id,
                error: 'SQS batch entry failure',
            }));

        failedPublishes.forEach(({ executionId, actionId, caseId, error }) => {
            Helper.logError('Failed to publish AutomatedActionsRequested event', {
                executionId,
                actionId,
                caseId,
                error,
            });
        });

        if (failedPublishes.length === 0) {
            return;
        }

        this.#EVENT_PUBLISH_FAILED += failedPublishes.length;
        await this.#logEventPublishFailures(failedPublishes);
    }

    /**
     * Test-only invoker for #publishAutomatedActionsRequestedBatch. Returns the
     * number of events reconciled as failed during this call.
     *
     * Reconciliation assumes `dto.id` is unique per execution (the PK), so
     * duplicate ids are not expected.
     * @param {Array<Object>} persistedDtos
     * @returns {Promise<number>}
     */
    // Test-only accessor — never call from production code.
    async _publishPersistedExecutionsForTest(persistedDtos) {
        const before = this.#EVENT_PUBLISH_FAILED;
        await this.#publishAutomatedActionsRequestedBatch(persistedDtos);
        return this.#EVENT_PUBLISH_FAILED - before;
    }

    /**
     * Logs event publishing failures for observability and reconciliation.
     * @param {Array<{executionId: string, actionId: string, caseId: string, error: string}>} failedPublishes
     */
    async #logEventPublishFailures(failedPublishes) {
        try {
            await this.#eventLogger.log('action-queue-execution.error', uuidv4(), null, {
                stage: 'event_publishing',
                total_failed: failedPublishes.length,
                details: failedPublishes,
            });
        } catch (logError) {
            Helper.logError('Error logging event publishing failures:', logError);
        }
    }
}
