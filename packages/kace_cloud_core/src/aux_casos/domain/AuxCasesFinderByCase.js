import { ValueObjectUuid } from '../../shared';

export class AuxCasesFinderByCase {
    /** @type {KnexAuxCasesRepository} is initialized in the constructor */
    #repository;
    /**
     *
     * @param {KnexAuxCasesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} caseId identificator for record to find
     * @param {object} [options] - Optional configuration
     * @param {boolean} [options.skipCache] - If true, bypasses the cache
     * @returns {Promise<AuxCases>}
     */
    async execute(caseId, options = {}) {
        return this.#repository.findByCaseId(new ValueObjectUuid('Caso id', caseId), options);
    }
}
