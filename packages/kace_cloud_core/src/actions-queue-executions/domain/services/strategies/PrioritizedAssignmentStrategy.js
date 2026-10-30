import { Helper } from '../../../../shared/infrastructure/utils/Helper.js';
import { ValueObjectAssignmentChangeType } from '../../../../cases/domain/ValueObjectAssignmentChangeType.js';

/**
 * Prioritized assignment strategy (assignLastResponsibleIgnoreDefault):
 * Iterates cases first. For each valid case:
 *   1. Looks up the last non-default-assignee responsible via history.
 *   2. If that user is in the available users list with remaining capacity → assign to them.
 *   3. Otherwise → assign to any available user with remaining capacity.
 *
 * Iteration order: cases → users (prioritized lookup per case).
 */
export class PrioritizedAssignmentStrategy {
    #caseActionValidator;
    #caseUserAssignmentService;
    #caseRepository;

    /**
     * @param {import('../../../../shared/domain/services/CaseActionValidator.js').CaseActionValidator} caseActionValidator
     * @param {Object} caseUserAssignmentService
     * @param {Object} eventLogger
     * @param {Object} caseRepository
     */
    constructor(caseActionValidator, caseUserAssignmentService, eventLogger, caseRepository, runObserver = null) {
        this.#caseActionValidator = caseActionValidator;
        this.#caseUserAssignmentService = caseUserAssignmentService;
        this.eventLogger = eventLogger;
        this.#caseRepository = caseRepository;
        this.runObserver = runObserver;
    }

    /**
     * @param {Object} params
     * @param {import('../../../../actions/domain/Action.js').Action} params.action
     * @param {string} params.groupId
     * @param {Array<{ id: string, remaining: number }>} params.usersInGroup
     * @param {Array} params.candidateCases
     * @param {Map<string, Object>} [params.contextMap] - Optional per-case prefetched context.
     * @param {Date|string|null} [params.evaluationNow] - Optional evaluation reference time.
     * @param {import('./CapacityTracker.js').CapacityTracker} params.capacityTracker
     *        Per-group tracker shared across every action processed in the same run.
     *        Carrying it across actions keeps `max_cases_per_user` honored when multiple
     *        actions target the same group.
     * @param {{ assigned: number, skipped: number, errors: number }} params.result - Mutated in place.
     */
    async execute({
        action,
        groupId,
        usersInGroup,
        candidateCases,
        contextMap,
        evaluationNow,
        result,
        capacityTracker,
    }) {
        const tracker = capacityTracker;
        const assignedCaseIds = new Set();

        Helper.logTime(
            `PrioritizedAssignmentStrategy::execute group=${groupId}, users=${usersInGroup.length}, cases=${candidateCases.length}`
        );
        for (const activeCase of candidateCases) {
            if (assignedCaseIds.has(activeCase.id.value)) continue;

            if (tracker.totalRemaining() <= 0) {
                Helper.logDebug(`PrioritizedAssignmentStrategy::execute all users exhausted in group ${groupId}`);
                break;
            }

            if (!(await this.#isValidCase(activeCase, action, contextMap, evaluationNow))) continue;

            const targetUserId = await this.#resolveTargetUser(activeCase, tracker);

            if (!targetUserId) {
                Helper.logDebug(
                    `PrioritizedAssignmentStrategy::execute no user available for case ${activeCase.id.value} in group ${groupId}`
                );
                result.skipped++;
                this.runObserver?.recordSkipReason(action?.id?.value, 'no_user_available_for_case');
                continue;
            }

            const originalValues = activeCase.toJson();
            try {
                await this.#caseUserAssignmentService.execute(
                    activeCase,
                    targetUserId,
                    groupId,
                    ValueObjectAssignmentChangeType.AUTOMATIC
                );
                assignedCaseIds.add(activeCase.id.value);
                const newRemaining = tracker.consume(targetUserId);
                result.assigned++;
                this.runObserver?.recordGroupAssignment(groupId);

                Helper.logInfo(
                    `PrioritizedAssignmentStrategy::execute assigned case ${activeCase.id.value} → user ${targetUserId} (group ${groupId}), remaining after=${newRemaining}`
                );

                await this.eventLogger?.logEvent({
                    success: true,
                    action,
                    caseEntity: activeCase,
                    originalValues,
                });
            } catch (assignError) {
                Helper.logError(
                    `PrioritizedAssignmentStrategy::execute failed to assign case ${activeCase.id.value} to user ${targetUserId}`,
                    assignError
                );
                result.errors++;
                await this.eventLogger?.logEvent({
                    success: false,
                    action,
                    caseEntity: activeCase,
                    originalValues,
                });
            }
        }

        const unassignedCount = candidateCases.length - assignedCaseIds.size;
        if (unassignedCount > 0 && tracker.totalRemaining() <= 0) {
            Helper.logInfo('automated-assignment.no-responsible-assigned', {
                reason: 'group_capacity_exhausted',
                groupId,
                actionId: action?.id?.value,
                unassignedCount,
            });
            this.runObserver?.recordSkipReason(action?.id?.value, 'group_capacity_exhausted', unassignedCount);
        }

        Helper.logTimeEnd(
            `PrioritizedAssignmentStrategy::execute group=${groupId}, users=${usersInGroup.length}, cases=${candidateCases.length}`
        );
    }

    /**
     * Validates a case against the action's conditions, using prefetched context when available.
     * @param {Object} activeCase
     * @param {import('../../../../actions/domain/Action.js').Action} action
     * @param {Map<string, Object>} [contextMap]
     * @param {Date|string|null} [evaluationNow]
     * @returns {Promise<boolean>}
     */
    async #isValidCase(activeCase, action, contextMap, evaluationNow) {
        try {
            return contextMap?.has(activeCase.id.value)
                ? await this.#caseActionValidator.validateWithContext(
                      activeCase,
                      action,
                      contextMap.get(activeCase.id.value),
                      { evaluationNow }
                  )
                : await this.#caseActionValidator.validate(activeCase, action);
        } catch (error) {
            Helper.logError(
                `PrioritizedAssignmentStrategy::isValidCase error validating case ${activeCase?.id?.value}`,
                error
            );
            return false;
        }
    }

    /**
     * Resolves the best user for a case:
     *   1. Checks history for the last non-default responsible user.
     *   2. If that user has capacity → returns them.
     *   3. Otherwise → returns the first available user.
     *
     * @param {Object} activeCase
     * @param {CapacityTracker} tracker
     * @returns {Promise<string|null>}
     */
    async #resolveTargetUser(activeCase, tracker) {
        try {
            const prioritizedId = await this.#caseRepository.getPrioritizedCandidateId(activeCase.id.value);

            if (prioritizedId && tracker.hasCapacity(prioritizedId)) {
                Helper.logDebug(
                    `PrioritizedAssignmentStrategy::resolveTargetUser case ${activeCase.id.value} → prioritized user ${prioritizedId}`
                );
                return String(prioritizedId);
            }
        } catch (error) {
            Helper.logError(
                `PrioritizedAssignmentStrategy::resolveTargetUser error getting prioritized user for case ${activeCase?.id?.value}`,
                error
            );
        }

        return tracker.firstAvailableUserId();
    }
}
