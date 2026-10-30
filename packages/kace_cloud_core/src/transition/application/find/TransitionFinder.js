import { TransitionsFinderDomain } from '../..';
import { TransitionsResponse } from '../TransitionsResponse';

export class TransitionFinder {
    /** @type {TransitionsFinderDomain} is initialized in the constructor*/
    #finder;

    /**
     *
     * @param {KnexTransitionsRepository} repository
     */
    constructor(repository) {
        this.#finder = new TransitionsFinderDomain(repository);
    }

    /**
     *
     * @param {string} id identificator for search transition
     * @returns {Promise<ResponseTransitions>}
     */
    async execute(id) {
        const transition = await this.#finder.execute(id);
        return transition ? new TransitionsResponse(transition) : null;
    }
}
