import { DomainCaseFinder } from '../..';
import { CustomError } from '../../../shared/errors/CustomError';
import { CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE } from '@kace/error-codes';
import { EventLogger } from '../../../shared/EventLogger';
import { ValueObjectUpdateSource } from '../../domain/ValueObjectUpdateSource';
import { ValueObjectAssignmentChangeType } from '../../domain/ValueObjectAssignmentChangeType';

export class CaseGroupAssigner {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;
    /** @type {AssignationService} is initialized in the constructor */
    #assignationService;
    /** @type {DomainCaseFinder} is initialized in the constructor */
    #finder;
    /** @type {import('../../../users').User} is initialized in the constructor */
    #currentUser;

    /**
     *
     * @param {KnexCaseRepository} repository
     * @param {import('../../../users').User} currentUser
     */
    constructor(repository, assignationService, currentUser) {
        this.#repository = repository;
        this.#assignationService = assignationService;
        this.#finder = new DomainCaseFinder(repository);
        this.#currentUser = currentUser;
        this.eventLogger = new EventLogger(repository);
    }

    /**
     *
     * @param {string} id identificator for search case
     * @returns {Promise<void>}
     */
    async execute(id, idGroup, cases) {
        const updateSource = ValueObjectUpdateSource.fromCasesCount(cases?.length);

        const kase = await this.#finder.execute(id);
        if (kase === null || kase.fecha_resolucion.value !== null) {
            throw new CustomError('The Case you are trying to reassign does not exist.', 404);
        }
        const responsable_id = await this.#assignationService.executeOrFail(idGroup, id);
        if (responsable_id === null) {
            throw new CustomError(
                'Could not assign a person responsible',
                404,
                [],
                CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE
            );
        }
        const now = new Date().toISOString();
        const payload = {
            responsable_id: responsable_id,
            grupo_id: idGroup,
            updated_by: this.#currentUser.id.value,
            updated_at: now,
            update_source: updateSource.value,
            assignment_change_type: ValueObjectAssignmentChangeType.MANUAL,
        };
        if (!this.#currentUser?.isServiceAccount) {
            payload.edited_by = this.#currentUser.id.value;
            payload.edited_at = now;
        }
        const originalValues = kase.toJson();
        kase.update(payload);

        await this.#repository.update(kase);
        await this.#repository.saveHistory(kase, originalValues);

        await this.eventLogger.log(
            'case.reassigned',
            id,
            this.#currentUser.id.value,
            kase.changedAttributes,
            id,
            kase.cliente_id.value,
            {
                responsable_id: originalValues.responsable_id,
                grupo_id: originalValues.grupo_id,
                transicion_id: originalValues.transicion_id,
                update_source: originalValues.update_source,
            }
        );
        kase.flushChanges();
    }
}
