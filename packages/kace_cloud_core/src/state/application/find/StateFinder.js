import { CustomError } from '../../../shared';
import { StateFinderDomain, StateResponse } from '../../index';

export class StateFinder {
    /** @type {StateFinderDomain} is initialized in the constructor */
    #finder;
    constructor(repository) {
        this.#finder = new StateFinderDomain(repository);
    }

    /**
     * Executes the finding of an State object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the State object to find.
     * @returns {Promise<StateResponse>} A promise that resolves to an StateResponse object containing the found State data.
     */
    async execute(id) {
        const state = await this.#finder.execute(id);
        if (!state || state.isDeleted()) {
            throw new CustomError('State not found', 404);
        }
        return new StateResponse(state);
    }
}
