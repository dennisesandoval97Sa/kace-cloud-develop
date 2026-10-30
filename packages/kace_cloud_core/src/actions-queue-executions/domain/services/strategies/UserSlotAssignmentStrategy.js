import { Helper } from '../../../../shared/infrastructure/utils/Helper.js';
import { ValueObjectAssignmentChangeType } from '../../../../cases/domain/ValueObjectAssignmentChangeType.js';

/**
 * Default assignment strategy: iterates users and fills each user's
 * remaining slots with the next valid case from the candidate list.
 *
 * Iteration order: users → cases.
 */
export class UserSlotAssignmentStrategy {
    #caseActionValidator;
    #caseUserAssignmentService;

    /**
     * @param {import('../../../../shared/domain/services/CaseActionValidator.js').CaseActionValidator} caseActionValidator
     * @param {Object} caseUserAssignmentService
     * @param {Object} eventLogger
     */
    constructor(caseActionValidator, caseUserAssignmentService, eventLogger, runObserver = null) {
        this.#caseActionValidator = caseActionValidator;
        this.#caseUserAssignmentService = caseUserAssignmentService;
        this.eventLogger = eventLogger;
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
     *        Source of truth for `remaining`; the `remaining` field on each `usersInGroup`
     *        entry reflects only the snapshot taken at the start of the run.
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
        const assignedCaseIds = new Set();

        Helper.logTime(
            `UserSlotAssignmentStrategy::execute action${action.id.value} group=${groupId}, users=${usersInGroup.length}, cases=${candidateCases.length}`
        );
        for (const userEntry of usersInGroup) {
            const { id: userId } = userEntry;

            if (!capacityTracker.hasCapacity(userId)) {
                Helper.logDebug(
                    `UserSlotAssignmentStrategy::execute user ${userId} has no remaining capacity in group ${groupId}, skipping`
                );
                continue;
            }

            Helper.logTime(
                `UserSlotAssignmentStrategy::execute user=${userId}, remaining=${capacityTracker.remaining(userId)}`
            );
            while (capacityTracker.hasCapacity(userId)) {
                const assignedCase = await this.#findFirstValidCase({
                    cases: candidateCases,
                    action,
                    excludedCaseIds: assignedCaseIds,
                    contextMap,
                    evaluationNow,
                });

                if (!assignedCase) {
                    Helper.logDebug(
                        `UserSlotAssignmentStrategy::execute no valid case for user ${userId} in group ${groupId} (remaining=${capacityTracker.remaining(userId)})`
                    );
                    result.skipped++;
                    this.runObserver?.recordSkipReason(action?.id?.value, 'no_valid_case_for_users');
                    break;
                }

                const originalValues = assignedCase.toJson();
                try {
                    await this.#caseUserAssignmentService.execute(
                        assignedCase,
                        userId,
                        groupId,
                        ValueObjectAssignmentChangeType.AUTOMATIC
                    );
                    assignedCaseIds.add(assignedCase.id.value);
                    const newRemaining = capacityTracker.consume(userId);
                    result.assigned++;
                    this.runObserver?.recordGroupAssignment(groupId);

                    Helper.logInfo(
                        `UserSlotAssignmentStrategy::execute assigned case ${assignedCase.id.value} → user ${userId} (group ${groupId}), remaining after=${newRemaining}`
                    );

                    await this.eventLogger?.logEvent({
                        success: true,
                        action,
                        caseEntity: assignedCase,
                        originalValues,
                    });
                } catch (assignError) {
                    Helper.logError(
                        `UserSlotAssignmentStrategy::execute failed to assign case ${assignedCase.id.value} to user ${userId}`,
                        assignError
                    );
                    result.errors++;
                    await this.eventLogger?.logEvent({
                        success: false,
                        action,
                        caseEntity: assignedCase,
                        originalValues,
                    });
                    break;
                }
            }
            Helper.logTimeEnd(
                `UserSlotAssignmentStrategy::execute user=${userId}, remaining=${capacityTracker.remaining(userId)}`
            );
        }
        const unassignedCount = candidateCases.length - assignedCaseIds.size;
        if (unassignedCount > 0 && capacityTracker.totalRemaining() <= 0) {
            Helper.logInfo('automated-assignment.no-responsible-assigned', {
                reason: 'group_capacity_exhausted',
                groupId,
                actionId: action?.id?.value,
                unassignedCount,
            });
            this.runObserver?.recordSkipReason(action?.id?.value, 'group_capacity_exhausted', unassignedCount);
        }
        Helper.logTimeEnd(
            `UserSlotAssignmentStrategy::execute action${action.id.value} group=${groupId}, users=${usersInGroup.length}, cases=${candidateCases.length}`
        );
    }

    /**
     * Returns the first candidate case that passes the action's condition check
     * and hasn't already been assigned in this run.
     *
     * @param {Object} params
     * @param {Array} params.cases
     * @param {import('../../../../actions/domain/Action.js').Action} params.action
     * @param {Set<string>} params.excludedCaseIds
     * @param {Map<string, Object>} [params.contextMap]
     * @param {Date|string|null} [params.evaluationNow]
     * @returns {Promise<Object|null>}
     */
    async #findFirstValidCase({ cases, action, excludedCaseIds, contextMap, evaluationNow }) {
        for (const activeCase of cases) {
            if (excludedCaseIds.has(activeCase.id.value)) {
                continue;
            }

            try {
                const isValid = contextMap?.has(activeCase.id.value)
                    ? await this.#caseActionValidator.validateWithContext(
                          activeCase,
                          action,
                          contextMap.get(activeCase.id.value),
                          { evaluationNow }
                      )
                    : await this.#caseActionValidator.validate(activeCase, action);
                if (isValid) {
                    return activeCase;
                }
            } catch (error) {
                Helper.logError(
                    `UserSlotAssignmentStrategy::findFirstValidCase error validating case ${activeCase?.id?.value} for action ${action?.id?.value}`,
                    error
                );
            }
        }

        return null;
    }
}
