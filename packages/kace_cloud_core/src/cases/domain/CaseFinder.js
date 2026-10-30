import { Criteria, CustomError, ValueObjectInt, ValueObjectUuid } from '../../shared';

export class CaseFinder {
    /** @type {import('../infrastructure/persistence/KnexCaseRepository').KnexCaseRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexCaseRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id identificator case to search
     * @returns {Promise<Case>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    async executeWithAllRelations(id) {
        return this.#repository.getCaseInformationWithAllRelations(new ValueObjectUuid('id', id));
    }

    /**
     * Find a case by its reference.
     * @param {number} reference - The reference of the case to search.
     * @returns {Promise<Case | null>} - The found case or null if not found.
     */
    async executeByReference(reference) {
        return this.#repository.findByReference(new ValueObjectInt('reference', reference));
    }

    /**
     * Find a case by criteria.
     * @param {object} dtoCriteria - Data object to search case.
     * @returns {Promise<Array<Case>>} - The found case or null if not found.
     */
    async executeByCriteria(dtoCriteria) {
        const tablename = this.#repository.tableName;
        return this.#repository.search(
            new Criteria(
                dtoCriteria.filter,
                dtoCriteria.relationship,
                dtoCriteria.limit,
                dtoCriteria.offset,
                dtoCriteria.order,
                tablename
            )
        );
    }

    /**
     * Find a case by its ID.
     * @param {string} id - The ID of the case to search.
     */
    async executeForAns(id) {
        const results = await this.#repository.findByIdForAns(new ValueObjectUuid('id', id));
        if (results.length === 0 || results[0].kase.isDeleted()) {
            throw new CustomError('Case not found');
        }
        if (results[0].kase.fecha_resolucion.value !== null) {
            throw new CustomError(`the Case with ID ${id} has been finalized`);
        }
        return results[0];
    }
    /**
     * Find available States by case its ID.
     * @param {string} id - The ID of the case to search.
     * @returns {Promise<CaseAvailableStates[]>} - The found case or null if not found.
     */
    async executeForAvailableStates(id) {
        return this.#repository.findByIdForAvailableStates(new ValueObjectUuid('id', id));
    }

    /**
     * Finds a case by description ID.
     *
     * @async
     * @param {string} descriptionId - The ID of the case description.
     * @returns {Promise<import('../domain/Case').Case|null>} Returns a Case instance if found, otherwise null.
     */
    async executeByDescriptionId(descriptionId) {
        return this.#repository.findByDescriptionId(new ValueObjectUuid('case_description_id', descriptionId));
    }
}
