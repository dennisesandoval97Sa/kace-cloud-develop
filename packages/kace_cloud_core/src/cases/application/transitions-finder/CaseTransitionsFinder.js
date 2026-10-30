import { DomainCaseTransitionFinder } from '../..';
import { CaseTransitionsResponse } from '../CaseTransitionsResponse';

export class CaseTransitionsFinder {
    /**
     * @type {DomainCaseTransitionFinder}
     * is initialized in the constructor
     */
    #transitionsFinder;

    /**
     *
     * @param {KnexCaseRepository} repository
     */
    constructor(repository) {
        this.#transitionsFinder = new DomainCaseTransitionFinder(repository);
    }

    /**
     *
     * @param {string} id case for fetch all transitions
     * @returns {Promise<CaseTransitionsResponse>}
     */
    async execute(id) {
        const caseTransitions = await this.#transitionsFinder.execute(id);
        return new CaseTransitionsResponse(caseTransitions);
    }
}
