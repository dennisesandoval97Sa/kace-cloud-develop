import { ValueObjectUuid } from '../../shared/index.js';

export class CaseSessionDurationFinder {
    /**
     * @type {KnexCaseSessionDurationRepository} is initialized in the constructor
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a CaseSessionDuration object by its ID.
     *
     * @param {string} id
     * @returns {Promise<CaseSessionDuration>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    /**
     * Finds an active (unfinished) CaseSessionDuration by case ID and user ID.
     *
     * @param {string} caseId
     * @param {string} userId
     * @returns {Promise<CaseSessionDuration|null>}
     */
    async findByCaseAndUser(caseId, userId) {
        return this.#repository.findByCaseAndUser(
            new ValueObjectUuid('case_id', caseId),
            new ValueObjectUuid('user_id', userId)
        );
    }
}
