import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid';

export class WSRestEndpointFinder {
    /** @type {KnexWSRestEndpointRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `WSRestEndpointFinder` class.
     *
     * @param {KnexWSRestEndpointRepository} repository - An instance of the repository that manages WS REST endpoint records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a WS REST endpoint by its ID.
     *
     * @param {string} id - The UUID of the WS REST endpoint to find.
     * @return {Promise<WSRestEndpoint | null>} A promise that resolves to the `WSRestEndpoint` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
