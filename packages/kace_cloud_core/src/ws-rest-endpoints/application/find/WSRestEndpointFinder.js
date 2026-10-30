import { CustomError } from '../../../shared/index.js';
import { DomainWSRestEndpointFinder, WSRestEndpointResponse } from '../../index.js';

export class WSRestEndpointFinder {
    /** @type {DomainWSRestEndpointFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `WSRestEndpointFinder` class.
     *
     * @param {KnexWSRestEndpointRepository} repository - An instance of the repository that manages WS REST endpoint records.
     */
    constructor(repository) {
        this.#finder = new DomainWSRestEndpointFinder(repository);
    }

    /**
     * Executes the finding of a `WSRestEndpoint` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `WSRestEndpoint` object to find.
     * @returns {Promise<WSRestEndpointResponse>} A promise that resolves to a `WSRestEndpointResponse` object containing the found endpoint data.
     */
    async execute(id) {
        const wsRestEndpoint = await this.#finder.execute(id);
        if (!wsRestEndpoint || wsRestEndpoint.isDeleted()) {
            throw new CustomError('Ws rest endpoint not found', 404);
        }

        return new WSRestEndpointResponse(wsRestEndpoint);
    }
}
