import { Helper } from '../../../shared/index';
import { CustomError } from '../../../shared/errors/CustomError';
import {
    CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
    CASE_ASSIGNMENT_USER_UNAVAILABLE,
    CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE,
    CASE_BULK_CASES_NOT_FOUND,
} from '@kace/error-codes';
import { DomainUserFinder } from '../../../users/index';
import { GroupFinderDomain } from '../../../grupos/index';
import { DomainUserGroupFinder } from '../../../user-group-relationships/index';
import { ValueObjectUpdateSource } from '../../domain/ValueObjectUpdateSource';
import { ValueObjectAssignmentChangeType } from '../../domain/ValueObjectAssignmentChangeType';
import { findAndValidateCases } from '../../domain/BulkCaseValidator';
import { EventLogger } from '../../../shared/EventLogger';

export class CaseBulkAssigner {
    #casesRepository;
    #userFinder;
    #groupFinder;
    #userGroupFinder;
    #user;
    #eventLogger;
    /** @type {import('../../../shared/assignation/AssignationService.js').AssignationService|null} */
    #assignationService;

    /**
     * @param {KnexCaseRepository} casesRepository
     * @param {KnexUsersRepository} usersRepository
     * @param {KnexGroupsRepository} groupsRepository
     * @param {KnexUserGroupRelationshipRepository} userGroupRelationshipRepository
     * @param {User} user
     * @param {import('../../../shared/assignation/AssignationService.js').AssignationService} [assignationService] - Optional. When provided and no responsible_id is given, the service resolves a responsible per case.
     */
    constructor(
        casesRepository,
        usersRepository,
        groupsRepository,
        userGroupRelationshipRepository,
        user,
        assignationService = null
    ) {
        this.#casesRepository = casesRepository;
        this.#userFinder = new DomainUserFinder(usersRepository);
        this.#groupFinder = new GroupFinderDomain(groupsRepository);
        this.#userGroupFinder = new DomainUserGroupFinder(userGroupRelationshipRepository);
        this.#user = user;
        this.#eventLogger = new EventLogger(casesRepository);
        this.#assignationService = assignationService;
    }

    async execute(caseIds, groupId, responsibleId, updateSource = null) {
        const hasResponsible = responsibleId != null && responsibleId !== '';

        const group = await this.#groupFinder.execute(groupId);
        if (!group?.isActive?.()) {
            throw new CustomError(
                'The group you are trying to assign does not exist or is unavailable.',
                422,
                ['groupId'],
                CASE_ASSIGNMENT_GROUP_UNAVAILABLE
            );
        }

        if (hasResponsible) {
            const targetUser = await this.#userFinder.execute(responsibleId);
            if (!targetUser?.isActive?.()) {
                throw new CustomError(
                    'The user you are trying to assign does not exist or is unavailable.',
                    422,
                    ['responsibleId'],
                    CASE_ASSIGNMENT_USER_UNAVAILABLE
                );
            }

            const userGroupRelation = await this.#userGroupFinder.execute(responsibleId, groupId);
            if (!userGroupRelation) {
                throw new CustomError(
                    'The user does not belong to the specified group.',
                    422,
                    ['responsibleId'],
                    CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE
                );
            }
        }

        if (!hasResponsible && this.#assignationService) {
            return this.#executeWithAssignation(caseIds, groupId, updateSource);
        }

        const { uniqueCaseIds, cases: originalCases } = await findAndValidateCases(this.#casesRepository, caseIds);

        const now = new Date();
        const resolvedUpdateSource =
            updateSource ?? ValueObjectUpdateSource.fromCasesCount(uniqueCaseIds?.length).value;
        const updatePayload = {
            grupo_id: groupId,
            update_source: resolvedUpdateSource,
            updated_at: now,
            updated_by: this.#user.id.value,
        };

        if (!this.#user?.isServiceAccount) {
            updatePayload.edited_by = this.#user.id.value;
            updatePayload.edited_at = now;
        }

        if (hasResponsible) {
            updatePayload.responsable_id = responsibleId;
            updatePayload.last_assigned_at = now;
            updatePayload.assignment_change_type = ValueObjectAssignmentChangeType.BULK;
        }

        await this.#casesRepository.withTransaction(async (trx) => {
            await this.#casesRepository.bulkAssign(uniqueCaseIds, updatePayload, { trx });
            await this.#casesRepository.bulkSaveAssignHistory(originalCases, updatePayload, { trx });
        });

        await this.#logAssignmentEvents(originalCases, updatePayload);
    }

    /**
     * Assigns each case to a responsible resolved via AssignationService.
     *
     * Resolution and persistence are interleaved (one transaction per case, sequentially)
     * so that WorkQueueService reads the real DB state on each iteration and distributes
     * load correctly across agents. Parallelising the resolution phase would cause all
     * cases to be assigned to the same agent (snapshot isolation).
     *
     * AssignationService memoizes group and global-config per groupId, so the only
     * repeated query across iterations is findCandidateForWorkQueue, which must reread
     * to reflect the previous write.
     *
     * Events are accumulated during the loop and emitted in parallel after all writes
     * are committed, so a logging failure never rolls back an assignment.
     *
     * Failure policy:
     *  - If a responsible cannot be resolved (null or throw): case is skipped; its group
     *    and responsible remain unchanged (explicit decision — moving a case to a group
     *    that cannot service it may be worse than not moving it).
     *  - Returns { assigned: string[], skipped: Array<{caseId, reason}> } reflecting the
     *    outcome so the caller can report clear user feedback rather than throwing HTTP errors.
     *
     * @param {string[]} caseIds
     * @param {string} groupId
     * @param {string|null} updateSource
     * @returns {Promise<{assigned: string[], skipped: Array<{caseId: string, reason: string}>}>}
     * @private
     */
    async #executeWithAssignation(caseIds, groupId, updateSource) {
        const { uniqueCaseIds, cases: originalCases } = await findAndValidateCases(this.#casesRepository, caseIds);

        // O(1) lookup; findAndValidateCases guarantees all ids exist,
        // so a missing entry signals a broken invariant — we throw instead of silently skipping history.
        const casesById = new Map(originalCases.map((c) => [c.id, c]));

        const now = new Date();
        const resolvedUpdateSource =
            updateSource ?? ValueObjectUpdateSource.fromCasesCount(uniqueCaseIds?.length).value;

        /** @type {string[]} */
        const assigned = [];
        /** @type {Array<{caseId: string, reason: string}>} */
        const skipped = [];
        /** @type {Array<{originalCase: Object, payload: Object}>} */
        const assignedCases = [];

        for (const caseId of uniqueCaseIds) {
            const originalCase = casesById.get(caseId);
            if (!originalCase) {
                throw new CustomError(`Case not found after validation: ${caseId}`, 404, [], CASE_BULK_CASES_NOT_FOUND);
            }

            let resolvedResponsibleId;
            try {
                resolvedResponsibleId = await this.#assignationService.execute(groupId, caseId);
            } catch (error) {
                // Resolution errors (group config missing, invalid type, etc.) are scoped to this
                // case — skip it rather than aborting the whole batch.
                Helper.logError(`CaseBulkAssigner: error resolving responsible for case ${caseId}`, error);
                skipped.push({
                    caseId,
                    reference: originalCase.reference,
                    reason: error?.message ?? 'resolution_error',
                });
                continue;
            }

            if (!resolvedResponsibleId) {
                // No agent is available for this case (e.g. session limit reached, empty group).
                // "No responsible available" is an expected business condition, not a system error.
                Helper.logWarning(
                    `CaseBulkAssigner: no responsible available for case ${caseId} in group ${groupId}, skipping`
                );
                skipped.push({
                    caseId,
                    reference: originalCase.reference,
                    reason: 'no_responsible_available',
                });
                continue;
            }

            const payload = {
                grupo_id: groupId,
                responsable_id: resolvedResponsibleId,
                update_source: resolvedUpdateSource,
                updated_at: now,
                updated_by: this.#user.id.value,
                last_assigned_at: now,
                assignment_change_type: ValueObjectAssignmentChangeType.BULK,
            };

            if (!this.#user?.isServiceAccount) {
                payload.edited_by = this.#user.id.value;
                payload.edited_at = now;
            }

            // Commit each case immediately so the next iteration's findCandidateForWorkQueue
            // reads the updated case count and routes to a different agent when appropriate.
            await this.#casesRepository.withTransaction(async (trx) => {
                await this.#casesRepository.bulkAssign([caseId], payload, { trx });
                await this.#casesRepository.bulkSaveAssignHistory([originalCase], payload, { trx });
            });

            assigned.push(caseId);
            assignedCases.push({ originalCase, payload });
        }

        // Emit events in parallel after all writes are committed.
        await Promise.allSettled(
            assignedCases.map(({ originalCase, payload }) => this.#logAssignmentEvents([originalCase], payload))
        );

        return { assigned, skipped };
    }

    /**
     * Logs one `case.reassigned` event per case in the batch.
     * Errors are swallowed so that a logging failure never rolls back an assignment.
     * @param {Array<Object>} originalCases - Raw rows fetched before the update.
     * @param {Object} updatePayload - The values written by the bulk update.
     * @private
     */
    async #logAssignmentEvents(originalCases, updatePayload) {
        const promises = originalCases.map((kase) =>
            this.#eventLogger.log(
                'case.reassigned',
                kase.id,
                this.#user.id.value,
                {
                    grupo_id: updatePayload.grupo_id,
                    responsable_id:
                        updatePayload.responsable_id !== undefined ? updatePayload.responsable_id : kase.responsable_id,
                    update_source: updatePayload.update_source,
                },
                kase.id,
                kase.cliente_id,
                {
                    responsable_id: kase.responsable_id,
                    grupo_id: kase.grupo_id,
                    transicion_id: kase.transicion_id,
                    update_source: kase.update_source,
                }
            )
        );

        await Promise.allSettled(promises);
    }
}
