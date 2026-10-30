import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid';

export class WSRestConditionalFinder {
    /** @type {KnexWSRestConditionalRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `WSRestConditionalFinder` class.
     *
     * @param {KnexWSRestConditionalRepository} repository - An instance of the repository that manages WS REST conditional records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a WS REST conditional by its ID.
     *
     * @param {string} id - The UUID of the WS REST conditional to find.
     * @return {Promise<WSRestConditional | null>} A promise that resolves to the `WSRestConditional` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
