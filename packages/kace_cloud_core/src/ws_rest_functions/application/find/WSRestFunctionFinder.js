import { WSRestFunctionFinder as DomainWSRestFunctionFinder } from '../../domain/WSRestFunctionFinder.js';
import { WSRestFunctionResponse } from '../WSRestFunctionResponse.js';

export class WSRestFunctionFinder {
    /**
     * @type {DomainWSRestFunctionFinder} is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexWSRestFunctionRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainWSRestFunctionFinder(repository);
    }

    /**
     * Executes the finding of an RestFunction object by its id.
     *
     * @param {string} id - The id of the RestFunction object to find.
     * @returns {Promise<?WSRestFunctionResponse>} A promise that resolves with the RestFunction object found.
     */
    async execute(id) {
        const restFunction = await this.#finder.execute(id);

        if (!restFunction || restFunction.isDeleted()) {
            return null;
        }

        return new WSRestFunctionResponse(restFunction);
    }
}
