import { StatusEnum } from '../enum/StatusEnum.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ActionTriggers, DomainError } from '../../../shared/index.js';
import { BackgroundProcessEnum } from '../../../shared/domain/enum/BackgroundProcessEnum.js';
import { ActionsQueueExecutions } from '../ActionsQueueExecutions.js';

/**
 * Service responsible for executing queued actions.
 * This service manages the processing of pending actions in the queue,
 * executing them sequentially and handling their lifecycle.
 */
export class ActionQueueExecutorService {
    /** @type {FindPendingCronJobsService} is initialized in the constructor */
    #findPendingCronJobsService;

    /** @type {DomainActionFinder} is initialized in the constructor */
    #actionFinder;

    /** @type {DomainCaseFinder} is initialized in the constructor */
    #caseFinder;

    /** @type {import('../../../shared/domain/services/ActionExecutor.js').ActionExecutor} is initialized in the constructor */
    #actionExecutor;

    /** @type {BackgroundExecutionService} is initialized in the constructor */
    #backgroundExecutionService;

    /** @type {KnexActionsQueueExecutionsRepository} is initialized in the constructor */
    #repository;

    /**
     * Domain service constructor
     *
     * @param {Object} dependencies Dependencies required for the service
     * @param {FindPendingCronJobsService} dependencies.findPendingCronJobsService Service for finding pending executions
     * @param {DomainActionFinder} dependencies.actionFinder Service for finding actions
     * @param {DomainCaseFinder} dependencies.caseFinder Service for finding cases
     * @param {ActionExecutor} dependencies.actionExecutor Service for executing actions
     * @param {BackgroundExecutionService} dependencies.backgroundExecutionService Service for background executions
     * @param {KnexActionsQueueExecutionsRepository} dependencies.repository Repository for accessing the execution queue
     */
    constructor({
        findPendingCronJobsService,
        actionFinder,
        caseFinder,
        actionExecutor,
        backgroundExecutionService,
        repository,
    }) {
        this.#findPendingCronJobsService = findPendingCronJobsService;
        this.#actionFinder = actionFinder;
        this.#caseFinder = caseFinder;
        this.#actionExecutor = actionExecutor;
        this.#backgroundExecutionService = backgroundExecutionService;
        this.#repository = repository;
    }

    /**
     * Processes all pending executions in the queue
     * This is the main entry point for processing actions in queue
     *
     * @returns {Promise<Object>} Execution result
     */
    async execute() {
        let processActivatedByThis = false;

        try {
            if (await this.#isAlreadyRunning()) {
                return this.#createSkipResult('already_running');
            }

            const pendingExecutions = await this.#findPendingCronJobsService.execute();

            if (!pendingExecutions || pendingExecutions.length === 0) {
                return this.#createSkipResult('no_pending_executions');
            }

            await this.#markBackgroundProcess(true);
            processActivatedByThis = true;

            const processingResult = await this.#processExecutions(pendingExecutions);

            return processingResult;
        } catch (error) {
            Helper.logError('Critical error in action queue execution:', error);
            return this.#createSkipResult('critical_error');
        } finally {
            if (processActivatedByThis) {
                await this.#markBackgroundProcess(false);
            }
        }
    }

    /**
     * Processes one execution using data directly from the event payload.
     * Creates an in-memory ActionsQueueExecutions instance and delegates
     * to #processSingleExecution — no DB read is performed.
     *
     * @param {Object} params
     * @param {string} params.executionId - ID of the persisted execution record
     * @param {string} params.actionId - ID of the action to execute
     * @param {string} params.caseId - ID of the case to execute against
     * @param {string} params.clientId - ID of the client
     * @param {string} params.triggerType - Trigger type (e.g. CRON_JOB)
     * @returns {Promise<{processed: number, successful: number, failed: number, successfulIds?: string[], failedIds?: string[]}>}
     */
    async executeByEventPayload({ executionId, actionId, caseId, clientId, triggerType, created_by, created_at }) {
        try {
            Helper.logDebug(`Processing execution ${executionId} from event payload`);

            const execution = ActionsQueueExecutions.create({
                id: executionId,
                action_id: actionId,
                case_id: caseId,
                client_id: clientId,
                status: StatusEnum.PENDING.value,
                trigger_type: triggerType,
                created_by,
                created_at,
            });

            const result = await this.#processSingleExecution(execution);

            if (result.success) {
                return {
                    processed: 1,
                    successful: 1,
                    failed: 0,
                    successfulIds: [result.executionId],
                    failedIds: [],
                };
            }

            return {
                processed: 1,
                successful: 0,
                failed: 1,
                successfulIds: [],
                failedIds: [result.executionId],
            };
        } catch (error) {
            Helper.logError(`Critical error in action queue execution for execution ${executionId}:`, error);
            return this.#createSkipResult('critical_error');
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
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: true,
            reason,
        };
    }

    /**
     * Verifies if the queue action processor is already running
     *
     * @returns {Promise<boolean>} True if a process is already running, false otherwise
     */
    async #isAlreadyRunning() {
        const backgroundExecution = await this.#getBackgroundExecution();

        if (backgroundExecution && backgroundExecution.execution_status && backgroundExecution.execution_status.value) {
            return true;
        }

        return false;
    }

    /**
     * Gets the background execution object for this process
     *
     * @returns {Promise<Object|null>} Background execution object or null if it doesn't exist
     */
    async #getBackgroundExecution() {
        return this.#backgroundExecutionService.findBackgroundExecution(
            BackgroundProcessEnum.ACTION_QUEUE_EXECUTOR.value
        );
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
            BackgroundProcessEnum.ACTION_QUEUE_EXECUTOR.value,
            { execution_status: status }
        );
    }

    /**
     * Processes a set of pending executions
     *
     * @param {ActionsQueueExecutions[]} pendingExecutions - List of pending executions
     * @returns {Promise<{processed: number, successful: number, failed: number, successfulIds: string[], failedIds: string[]}>} Processing result
     */
    async #processExecutions(pendingExecutions) {
        const successfulIds = [];
        const failedIds = [];
        let processed = 0;
        let successful = 0;
        let failed = 0;

        for (const execution of pendingExecutions) {
            const result = await this.#processSingleExecution(execution);

            processed++;
            if (result.success) {
                successful++;
                successfulIds.push(result.executionId);
            } else {
                failed++;
                failedIds.push(result.executionId);
            }
        }

        return { processed, successful, failed, successfulIds, failedIds };
    }

    /**
     * Processes a single execution
     *
     * @param {ActionsQueueExecutions} execution - Execution to process
     * @returns {Promise<{success: boolean, executionId: string, error?: string}>} Processing result
     */
    async #processSingleExecution(execution) {
        try {
            Helper.logDebug(`Processing execution ${execution.id.value}`);

            execution.status = StatusEnum.IN_PROGRESS.value;
            execution.start_execution = new Date().toISOString();
            await this.#repository.update(execution);

            const action = await this.#actionFinder.execute(execution.action_id.value);
            if (!action) {
                throw new DomainError(`Action with ID ${execution.action_id.value} not found`);
            }

            const kase = await this.#caseFinder.execute(execution.case_id.value);
            if (!kase) {
                throw new DomainError(`Case with ID ${execution.case_id.value} not found`);
            }
            Helper.logDebug(`Processing action ${action.description.value} for case ${kase.reference.value}`);
            const result = await this.#actionExecutor.execute(action, kase, undefined, ActionTriggers.CRON_JOB.value);

            if (result) {
                execution.status = StatusEnum.COMPLETED.value;
                execution.end_execution = new Date().toISOString();
                await this.#repository.update(execution);

                Helper.logDebug(`Execution ${execution.id.value} completed successfully`);
                return { success: true, executionId: execution.id.value };
            } else {
                throw new DomainError(`Error executing action ${action.id.value} for case ${kase.id.value}`);
            }
        } catch (error) {
            Helper.logError(`Error processing execution ${execution.id.value}: ${error.message}`, error);

            execution.status = StatusEnum.FAILED.value;
            execution.end_execution = new Date().toISOString();
            await this.#repository.update(execution);

            return {
                success: false,
                executionId: execution.id.value,
            };
        }
    }
}
