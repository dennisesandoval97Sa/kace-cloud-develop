import { CustomError } from '../../../shared/index.js';
import { DomainWSRestConditionalFinder, WSRestConditionalResponse } from '../../index.js';

export class WSRestConditionalFinder {
    /** @type {DomainWSRestConditionalFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `WSRestConditionalFinder` class.
     *
     * @param {KnexWSRestConditionalRepository} repository - An instance of the repository that manages WS REST conditional records.
     */
    constructor(repository) {
        this.#finder = new DomainWSRestConditionalFinder(repository);
    }

    /**
     * Executes the finding of a `WSRestConditional` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `WSRestConditional` object to find.
     * @returns {Promise<WSRestConditionalResponse>} A promise that resolves to a `WSRestConditionalResponse` object containing the found conditional data.
     */
    async execute(id) {
        const wsRestConditional = await this.#finder.execute(id);
        if (!wsRestConditional || wsRestConditional.isDeleted()) {
            throw new CustomError('Ws rest conditional not found', 404);
        }

        return new WSRestConditionalResponse(wsRestConditional);
    }
}
