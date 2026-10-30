import { ValueObjectUuid } from '../../shared/index.js';

export class WSRestFlowFinder {
    /** @type {KnexWSRestFlowRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `WSRestFlowFinder` class.
     *
     * @param {KnexWSRestFlowRepository} repository - An instance of the repository that manages WS REST flow records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a WS REST flow by its ID.
     *
     * @param {string} id - The UUID of the WS REST flow to find.
     * @return {Promise<WSRestFlow | null>} A promise that resolves to the `WSRestFlow` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
