import { DomainCaseFinder } from '../../index';
import { DomainUserFinder } from '../../../users/index';
import { GroupFinderDomain } from '../../../grupos/index';
import { ValidationFailError, Helper } from '../../../shared/index';
import { EventLogger } from '../../../shared/EventLogger';
import { ValueObjectAssignmentChangeType } from '../../domain/ValueObjectAssignmentChangeType.js';
export class CaseUserAssigner {
    /** @type {import('../../../shared/application/events/EventPublisher.js').EventPublisher|null} */
    #eventPublisher;

    /**
     * @param {KnexCaseRepository} casesRepository
     * @param {KnexUsersRepository} usersRepository
     * @param {KnexGroupsRepository} groupsRepository
     * @param {User} userSignedIn
     * @param {import('../../../shared/application/events/EventPublisher.js').EventPublisher} [eventPublisher] - Optional event publisher for domain events
     */
    constructor(casesRepository, usersRepository, groupsRepository, userSignedIn, eventPublisher) {
        this.casesRepository = casesRepository;
        this.casefinder = new DomainCaseFinder(casesRepository);
        this.userFinder = new DomainUserFinder(usersRepository);
        this.groupFinder = new GroupFinderDomain(groupsRepository);
        this.userSignedIn = userSignedIn;
        this.#eventPublisher = eventPublisher || null;
        this.eventLogger = new EventLogger(casesRepository);
    }

    /**
     * Assigns a case to a user within a group.
     *
     * @param {string} caseId - The ID of the case to be assigned.
     * @param {string} grupoId - The ID of the group to which the case is assigned.
     * @param {string} responsableId - The ID of the user responsible for the case.
     * @throws {ValidationFailError} If the case, user, or group is invalid.
     */
    async execute(caseId, grupoId, responsableId, updateSource) {
        const kase = await this.casefinder.execute(caseId);
        this.ensureIsValidCase(kase);

        const user = await this.userFinder.execute(responsableId);
        this.ensureIsValidUser(user);

        const group = await this.groupFinder.execute(grupoId);
        this.ensureIsValidGroup(group);

        const originalValues = kase.toJson();
        const now = new Date().toISOString();
        const assignPayload = {
            responsable_id: responsableId,
            grupo_id: grupoId,
            updated_by: this.userSignedIn.id.value,
            updated_at: now,
            update_source: updateSource,
            assignment_change_type: ValueObjectAssignmentChangeType.MANUAL,
        };
        if (!this.userSignedIn?.isServiceAccount) {
            assignPayload.edited_by = this.userSignedIn.id.value;
            assignPayload.edited_at = now;
        }
        kase.assignToUser(assignPayload);

        await this.casesRepository.update(kase);
        await this.casesRepository.saveHistory(kase, originalValues);

        await this.eventLogger.log(
            'case.reassigned',
            caseId,
            this.userSignedIn.id.value,
            kase.changedAttributes,
            caseId,
            kase.cliente_id.value,
            {
                responsable_id: originalValues.responsable_id,
                grupo_id: originalValues.grupo_id,
                transicion_id: originalValues.transicion_id,
                update_source: originalValues.update_source,
            }
        );

        await this.#publishDomainEvents(kase, originalValues);

        kase.flushChanges();
    }

    ensureIsValidGroup(group) {
        if (!group || group.deleted_at.value !== null) {
            throw new ValidationFailError('The group you are trying to assign does not exist.', 'groupId');
        }
    }

    ensureIsValidUser(user) {
        if (!user || user.deleted_at.value !== null) {
            throw new ValidationFailError('User not found', 'responsableId');
        }
    }

    ensureIsValidCase(kase) {
        if (kase === null || kase.fecha_resolucion.value !== null) {
            throw new ValidationFailError('The Case you are trying to reassign does not exist.', 'caseId');
        }
    }

    /**
     * Records and publishes domain events for the case assignment.
     * @param {import('../../domain/Case.js').Case} kase - The assigned case
     * @param {Object} originalValues - The original case values before assignment
     * @private
     */
    async #publishDomainEvents(kase, originalValues) {
        if (!this.#eventPublisher) {
            return;
        }

        try {
            const domainEvents = kase.pullDomainEvents();
            await this.#eventPublisher.publishAll(domainEvents);
        } catch (error) {
            Helper.logError('CaseUserAssigner: Failed to publish domain events', error);
        }
    }
}
