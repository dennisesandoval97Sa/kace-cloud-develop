import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ActionTypes } from '../../../actions/domain/ActionTypes.js';
import { BackgroundProcessEnum } from '../../../shared/domain/enum/BackgroundProcessEnum.js';
import { RUN_STATUS } from '../../../automated-assignment-runs/domain/services/AssignmentRunObserver.js';

export class AutomatedGroupAssignmentExecutor {
    /** @type {import('../../domain/services/ActionsProcessor.js').ActionsProcessor} */
    #actionsProcessor;

    /** @type {import('../../domain/services/AutomatedGroupAssignmentService.js').AutomatedGroupAssignmentService} */
    #automatedGroupAssignmentService;

    /** @type {import('../../../shared/domain/services/background-execution/BackgroundExecutionService.js').BackgroundExecutionService} */
    #backgroundExecutionService;

    /** @type {import('../../../automated-assignment-runs/domain/services/AssignmentRunObserver.js').AssignmentRunObserver|null} */
    #runObserver;

    /**
     * @param {import('../../domain/services/ActionsProcessor.js').ActionsProcessor} actionsProcessor
     * @param {import('../../domain/services/AutomatedGroupAssignmentService.js').AutomatedGroupAssignmentService} automatedGroupAssignmentService
     * @param {import('../../../shared/domain/services/background-execution/BackgroundExecutionService.js').BackgroundExecutionService} backgroundExecutionService
     */
    constructor(actionsProcessor, automatedGroupAssignmentService, backgroundExecutionService, runObserver = null) {
        this.#actionsProcessor = actionsProcessor;
        this.#automatedGroupAssignmentService = automatedGroupAssignmentService;
        this.#backgroundExecutionService = backgroundExecutionService;
        this.#runObserver = runObserver;
    }

    /**
     * Executes the Work-Queue Group Assignment (Pull) flow:
     * 1. Checks BackgroundExecution guard to prevent concurrent runs.
     * 2. Finds CRON_JOB actions and keeps only isGroupAssignment types.
     * 3. Validates automation eligibility.
     * 4. Delegates to AutomatedGroupAssignmentService which handles both
     *    cola_de_trabajo (user-slot) and non-cola_de_trabajo (direct) assignment.
     *
     * @returns {Promise<{assigned: number, skipped: number, errors: number, noActions: boolean}>}
     */
    async execute() {
        // Solo la invocación que adquirió el lock puede liberarlo: la salida temprana
        // already_running NO debe apagar el flag de la ejecución que sigue en curso
        // (hacerlo dejaba entrar una tercera invocación en paralelo bajo carga).
        let lockAcquired = false;
        try {
            Helper.logDebug('AutomatedGroupAssignmentExecutor::execute start');

            if (await this.#isAlreadyRunning()) {
                Helper.logDebug('AutomatedGroupAssignmentExecutor::execute already running, skipping.');
                this.#runObserver?.recordOutcome(RUN_STATUS.ALREADY_RUNNING);
                return { assigned: 0, skipped: 0, errors: 0, noActions: false, skippedReason: 'already_running' };
            }
            await this.#markBackgroundProcess(true);
            lockAcquired = true;

            const foundActions = await this.#actionsProcessor.findActionsIfEligible({
                actionTypeFilter: {
                    include: [...ActionTypes.GROUP_ASSIGNMENT_TYPES],
                },
                service: 'AutomatedGroupAssignmentExecutor',
            });

            if (!foundActions || foundActions.length === 0) {
                Helper.logInfo(
                    'AutomatedGroupAssignmentExecutor::execute no group-assignment CRON_JOB actions found, skipping.'
                );
                this.#runObserver?.recordOutcome(RUN_STATUS.NO_ACTIONS);
                return { assigned: 0, skipped: 0, errors: 0, noActions: true };
            }

            await this.#actionsProcessor.process(foundActions);

            // Antes de cualquier early-return: el detalle del run debe explicar por qué
            // se descartó cada acción (ventana vencida, cron no coincide, etc.).
            this.#runObserver?.recordNotApplicableActions(this.#actionsProcessor.getNotApplicableActions?.());

            const groupAssignmentActions = this.#actionsProcessor.getGroupAssignmentActions();

            Helper.logDebug(
                `AutomatedGroupAssignmentExecutor::execute groupAssignmentActions=${groupAssignmentActions.length}`
            );

            if (groupAssignmentActions.length === 0) {
                this.#actionsProcessor.clearProcessedActions();
                this.#runObserver?.recordOutcome(RUN_STATUS.NO_ELIGIBLE_ACTIONS);
                return { assigned: 0, skipped: 0, errors: 0, noActions: true };
            }

            this.#runObserver?.recordActionsFound(groupAssignmentActions);

            const result = await this.#automatedGroupAssignmentService.assign({
                actions: groupAssignmentActions,
            });

            this.#runObserver?.recordTotals({
                assigned: result.assigned,
                skipped: result.skipped,
                errors: result.errors,
            });
            this.#runObserver?.recordOutcome(RUN_STATUS.COMPLETED);

            this.#actionsProcessor.clearProcessedActions();

            Helper.logInfo(
                `AutomatedGroupAssignmentExecutor::execute done | assigned=${result.assigned}, skipped=${result.skipped}, errors=${result.errors}`
            );

            return {
                assigned: result.assigned,
                skipped: result.skipped,
                errors: result.errors,
                noActions: false,
            };
        } catch (error) {
            Helper.logError('AutomatedGroupAssignmentExecutor::execute critical error', error);
            this.#runObserver?.recordError(error);
            this.#actionsProcessor.clearProcessedActions();
            return { assigned: 0, skipped: 0, errors: 1, criticalError: true };
        } finally {
            if (lockAcquired) {
                await this.#markBackgroundProcess(false);
            }
        }
    }

    /**
     * Checks if this work-queue group assignment process is already running.
     * Uses AUTOMATED_GROUP_ASSIGNMENT (not ACTION_QUEUE_EXECUTION used by the old executor).
     * @returns {Promise<boolean>}
     */
    async #isAlreadyRunning(stalenessMinutes = 30) {
        try {
            const backgroundExecution = await this.#backgroundExecutionService.findBackgroundExecution(
                BackgroundProcessEnum.AUTOMATED_GROUP_ASSIGNMENT.value
            );
            if (
                !backgroundExecution ||
                !backgroundExecution.execution_status ||
                !backgroundExecution.execution_status.value
            ) {
                return false;
            }
            if (backgroundExecution.isStale(stalenessMinutes)) {
                return false;
            }
            return true;
        } catch (error) {
            Helper.logError('AutomatedGroupAssignmentExecutor::isAlreadyRunning error', error);
            return false;
        }
    }

    /**
     * Marks the background process as running or not.
     * @param {boolean} status - true = running, false = not running
     * @returns {Promise<void>}
     */
    async #markBackgroundProcess(status) {
        try {
            await this.#backgroundExecutionService.updateBackgroundExecution(
                BackgroundProcessEnum.AUTOMATED_GROUP_ASSIGNMENT.value,
                { execution_status: status }
            );
        } catch (error) {
            Helper.logError('AutomatedGroupAssignmentExecutor::markBackgroundProcess error', error);
        }
    }
}
