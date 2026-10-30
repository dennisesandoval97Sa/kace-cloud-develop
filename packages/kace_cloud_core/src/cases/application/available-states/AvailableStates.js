import { CustomError } from '../../../shared/errors/CustomError';
import { AvailableStatesCollectionsResponse, DomainCaseFinder } from '../../index';

export class AvailableStates {
    /**
     * @type {DomainCaseFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexCaseRepository} repository
     */
    constructor(caseRepository) {
        this.#finder = new DomainCaseFinder(caseRepository);
    }

    /**
     *
     * @param {string} id identificator case to clone
     * @param {string} newId identificator for case cloned
     * @returns {Promise<void>}
     */
    async execute(id) {
        const kase = await this.#finder.executeForAvailableStates(id);
        if (!kase) throw new CustomError('Case not found', 404);
        return new AvailableStatesCollectionsResponse(kase);
    }
}
