import { ActionTriggers } from '../../../shared/domain/enum/ActionTriggersEnum.js';
import { BackgroundProcessEnum } from '../../../shared/domain/enum/BackgroundProcessEnum.js';
import { Helper } from '../../../shared/index.js';
import { ActionTypes } from '../../../actions/domain/ActionTypes.js';

export class ActionsProcessor {
    /** @type {import('../../../automation-settings/domain/AutomationValidationService.js').AutomationValidationService} is initialized in the constructor */
    #automationValidationService;
    /** @type {Array} Standard (non-group) validated actions */
    #standardActions;

    /** @type {Array} Group-assignment validated actions (isGroupAssignment) */
    #groupAssignmentActions;

    /** @type {Array<{action: Object, reason: string}>} Actions discarded by automation validation, with the reason */
    #notApplicableActions;

    /**
     * @param {FinderByTrigger} finderByTrigger - Service used to find actions by a specific trigger.
     * @param {AutomationValidationService} automationValidationService - Service to validate if an action is eligible based on its automation.
     */
    constructor(finderByTrigger, automationValidationService) {
        this.finderByTrigger = finderByTrigger;
        Helper.logDebug('ActionProcessor::constructor::finderByTrigger', typeof this.finderByTrigger);
        this.#automationValidationService = automationValidationService;
        this.#standardActions = [];
        this.#groupAssignmentActions = [];
        this.#notApplicableActions = [];
    }

    /**
     * Verifies if the queue action processor is already running, ignoring stale locks.
     *
     * @param {BackgroundExecutionService} backgroundExecutionService
     * @param {{stalenessMinutes?: number}} [options]
     * @returns {Promise<boolean>} True only if a fresh lock exists.
     */
    async isAlreadyRunning(backgroundExecutionService, { stalenessMinutes = 30 } = {}) {
        const backgroundExecution = await backgroundExecutionService.findBackgroundExecution(
            BackgroundProcessEnum.ACTION_QUEUE_EXECUTION.value
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
    }

    /**
     * Finds actions triggered by CRON_JOB if the background process is allowed to execute.
     * Always scopes results to actions with entity='case', regardless of any entityFilter
     * the caller supplies. This keeps the cases pipeline isolated from user/group actions.
     *
     * @param {Object} [options]
     * @param {Object} [options.actionTypeFilter]
     * @param {string[]} [options.actionTypeFilter.include] - Only return these action_type values.
     * @param {string[]} [options.actionTypeFilter.exclude] - Exclude these action_type values.
     * @returns {Promise<Array|Null>} A list of actions if allowed, or null if execution is not permitted.
     */
    async findActionsIfEligible(options = {}) {
        return this.finderByTrigger.execute(ActionTriggers.CRON_JOB.value, {
            ...options,
            entityFilter: 'case',
        });
    }

    /**
     * Validates and filters actions based on automation rules.
     * Only actions that pass validation are stored for further processing.
     *
     * @param {Array|Object} actionsOrSingle - A single action or an array of actions to process.
     */
    async process(actionsOrSingle) {
        const actions = Array.isArray(actionsOrSingle) ? actionsOrSingle : [actionsOrSingle];

        const applicableIds = [];
        const notApplicableIds = [];

        for (const action of actions) {
            const { applicable, reason } = await this.#automationValidationService.evaluate(action.automation_id.value);
            Helper.logDebug(
                `Automation is applicable for action ${action.id.value}: ${applicable}${applicable ? '' : ` (${reason})`}`
            );

            if (!applicable) {
                notApplicableIds.push(action.id.value);
                this.#notApplicableActions.push({ action, reason });
                continue;
            }
            applicableIds.push(action.id.value);

            if (ActionTypes.isGroupAssignment(action.action_type.value)) {
                this.#groupAssignmentActions.push(action);
            } else {
                this.#standardActions.push(action);
            }
        }

        Helper.logInfo('ActionsProcessor.applicabilityResults', {
            total: actions.length,
            applicable: applicableIds.length,
            notApplicable: notApplicableIds.length,
        });
        Helper.logDebug2('ActionsProcessor.applicabilityResults.ids', {
            applicableIds,
            notApplicableIds,
        });
    }
    /**
     * Returns only standard (non-group-assignment) validated actions.
     * Feed these into the standard cartesian pipeline.
     *
     * @returns {Array}
     */
    getStandardActions() {
        return this.#standardActions;
    }

    /**
     * Returns only group-assignment validated actions (isGroupAssignment types).
     * Feed these into the group-assignment pipeline.
     *
     * @returns {Array}
     */
    getGroupAssignmentActions() {
        return this.#groupAssignmentActions;
    }

    /**
     * Returns ALL validated actions (standard + group assignment).
     * Kept for backward-compatibility.
     *
     * @returns {Array}
     */
    getProcessedActions() {
        return [...this.#standardActions, ...this.#groupAssignmentActions];
    }

    /**
     * Returns actions discarded by automation validation, each with its reason
     * (one of AUTOMATION_NOT_APPLICABLE_REASON).
     *
     * @returns {Array<{action: Object, reason: string}>}
     */
    getNotApplicableActions() {
        return this.#notApplicableActions;
    }

    /**
     * Clears both processed action collections.
     */
    clearProcessedActions() {
        this.#standardActions = [];
        this.#groupAssignmentActions = [];
        this.#notApplicableActions = [];
    }
}
