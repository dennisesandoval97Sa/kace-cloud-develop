import { DomainWSRestEndpointFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class WSRestEndpointDeleter {
    /** @type {KnexWSRestEndpointRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainWSRestEndpointFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `WSRestEndpointDeleter` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages WS REST endpoints.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainWSRestEndpointFinder(repository);
    }

    /**
     * Deletes a WSRestEndpoint object from the repository.
     *
     * @param {string} id - The unique identifier of the WSRestEndpoint object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the deletion process.
     * @returns {Promise<void>} A promise that resolves when the WSRestEndpoint object is deleted.
     */
    async execute(id, dto) {
        const wsRestEndpoint = await this.#finder.execute(id);

        if (!wsRestEndpoint) {
            throw new CustomError(`WSRestEndpoint with id ${id} does not exist.`, 404);
        }

        wsRestEndpoint.delete(dto);

        await this.#repository.delete(wsRestEndpoint);

        wsRestEndpoint.flushChanges();
    }
}
