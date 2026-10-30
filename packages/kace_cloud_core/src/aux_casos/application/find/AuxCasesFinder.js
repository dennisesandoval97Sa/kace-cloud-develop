import { AuxCaseResponse } from '../AuxCaseResponse';
import { DomainAuxCasesFinderByCase } from '../../index.js';

export class AuxCasesFinder {
    /**
     * @param {DomainAuxCasesFinderByCase}
     * is initialized in the constructor
     */
    #finder;

    /**
     *
     * @param {KnexAuxCasesRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainAuxCasesFinderByCase(repository);
    }

    /**
     *
     * @param {string} caseId dentificator record to find
     * @param {object} [options] - Optional configuration
     * @param {boolean} [options.skipCache] - If true, bypasses the cache
     * @returns {Promise<AuxCaseResponse>}
     */
    async execute(caseId, options = {}) {
        const auxCase = await this.#finder.execute(caseId, options);
        return new AuxCaseResponse(auxCase);
    }
}
