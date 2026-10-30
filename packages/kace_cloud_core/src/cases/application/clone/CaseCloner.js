import { ValidationFailError, ValueObjectUuid } from '../../../shared';
import { CustomError } from '../../../shared/errors/CustomError';
import { DomainCaseFinder } from '../../index';
import { ValueObjectAssignmentChangeType } from '../../domain/ValueObjectAssignmentChangeType.js';

export class CaseCloner {
    /**
     * @type {KnexCaseRepository}
     * is initialized in the constructor
     */
    #repository;
    /**
     * @type {KnexAuxCasesRepository}
     * is initialized in the constructor
     */
    #auxCasesRepository;
    /**
     * @type {AuxDefinitionDataStructureFinder}
     * is initialized in the constructor
     */
    #auxDataStructureFinder;
    /**
     * @type {CommentCreator}
     * is initialized in the constructor
     */
    #commentCreator;
    /**
     * @type {DomainCaseFinder}
     * is initialized in the constructor
     */
    #finder;
    /**
     * @type {import('../folio/CaseFolioResolver.js').CaseFolioResolver|null}
     * is initialized in the constructor
     */
    #folioResolver;

    /**
     * @param {KnexCaseRepository} caseRepository
     * @param {KnexAuxCasesRepository} auxCasesRepository
     * @param {AuxDefinitionDataStructureFinder} auxDataStructureFinder
     * @param {CommentCreator} [commentCreator] - required only when cloning with a comment.
     * @param {import('../folio/CaseFolioResolver.js').CaseFolioResolver} [folioResolver] - gives
     *   the clone its own folio. Case.clone() clears the original's, which the unique index
     *   would reject, so without it the clone has none.
     */
    constructor(caseRepository, auxCasesRepository, auxDataStructureFinder, commentCreator, folioResolver = null) {
        this.#repository = caseRepository;
        this.#auxCasesRepository = auxCasesRepository;
        this.#auxDataStructureFinder = auxDataStructureFinder;
        this.#commentCreator = commentCreator;
        this.#finder = new DomainCaseFinder(caseRepository);
        this.#folioResolver = folioResolver;
    }

    /**
     *
     * @param {string} id identificator case to clone
     * @param {object} body Dto for clone case
     * @param {string} body.id - ID for case cloned.
     * @param {string} [body.transicion_id] - Transition for case cloned.
     * @param {string} [body.grupo_id] - Group for case cloned.
     * @param {string} [body.responsable_id] - Responsible for case cloned.
     * @param {string} clonedBy - user performing the clone.
     * @param {object} [comment] - comment dto saved on the cloned case in the same transaction.
     * @returns {Promise<void>}
     */
    async execute(id, body, clonedBy, comment = null) {
        let originalCase = await this.#finder.execute(id);
        if (originalCase === null) throw new CustomError('Case not found', 404);
        const { id: newId, ...data } = body;
        const cloneCase = originalCase.clone(newId, clonedBy);

        if (Object.keys(data).length) {
            cloneCase.update(data);
        }

        cloneCase.assignment_change_type = ValueObjectAssignmentChangeType.CREATION;

        const findCaseByClonedCaseId = await this.#finder.execute(cloneCase.id.value);
        if (findCaseByClonedCaseId) {
            throw new ValidationFailError(`Case with id ${findCaseByClonedCaseId.id.value} already exists`, 'id');
        }

        const auxDataStructure = await this.#auxDataStructureFinder.execute(this.#auxCasesRepository.tableName);

        const trx = await this.#repository.startTransaction();
        try {
            // Locked until commit: the copy is the aux_cases version current at commit. The case fields
            // come from the earlier read of originalCase, so both are not one snapshot.
            const originalAux = await this.#auxCasesRepository.findByCaseId(originalCase.id, {
                trx,
                forUpdate: true,
            });
            const cloneAux = originalAux?.clone(
                ValueObjectUuid.random(),
                cloneCase.id.value,
                clonedBy,
                auxDataStructure
            );

            // Last step before the INSERT, inside the clone's transaction: the counter row stays
            // locked only until the case is written, and a rollback returns the number.
            if (this.#folioResolver) {
                const folio = await this.#folioResolver.execute({
                    classificationId: cloneCase.clasificacion_id.value,
                    caseDto: cloneCase.toJson(),
                    auxData: cloneAux?.data?.value ?? {},
                    trx,
                });
                if (folio) {
                    cloneCase.folio = folio;
                }
            }

            await this.#repository.save(cloneCase, trx);
            await this.#repository.saveHistory(cloneCase, null, trx);
            if (cloneAux) {
                await this.#auxCasesRepository.save(cloneAux, trx);
                await this.#auxCasesRepository.saveHistoryWithRelationships(cloneAux, null, cloneAux.caso_id, trx);
            }
            if (comment) {
                await this.#commentCreator.execute(
                    { ...comment, caso_id: cloneCase.id.value, created_by: clonedBy },
                    trx
                );
            }
            await trx.commit();
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }
}
