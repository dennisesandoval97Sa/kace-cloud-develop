import { ValueObjectDescription } from '../../grupos/index.js';
import { ValueObjectUuid } from '../../shared/index.js';

export class ActionFinder {
    /**
     * @type {KnexActionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionFinder` class.
     *
     * @param {KnexActionRepository} repository - An instance of the repository that manages Action records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds an Action record by its ID.
     *
     * @param {string} id - The UUID of the Action record to find.
     * @return {Promise<Action>} A promise that resolves to the `Action` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    /**
     * Finds an Action record by its ID.
     *
     * @param {string} description - The description of the Action to search.
     * @return {Promise<Action>} A promise that resolves to the `Action` instance if found, or `null` if not found.
     */
    async executeByDescription(description) {
        return this.#repository.findByDescription(new ValueObjectDescription('description', description));
    }
}
