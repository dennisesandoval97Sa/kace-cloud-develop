import { ValueObjectUuid } from '../../shared/index.js';

export class ActionUpdateModelFinder {
    /**
     * @type {KnexActionUpdateModelRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionUpdateModelFinder` class.
     *
     * @param {KnexActionUpdateModelRepository} repository - An instance of the repository that manages ActionUpdateModel records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a ActionUpdateModel record by its ID.
     *
     * @param {string} id - The UUID of the ActionUpdateModel record to find.
     * @return {Promise<ActionUpdateModel | null>} A promise that resolves to the `ActionUpdateModel` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
