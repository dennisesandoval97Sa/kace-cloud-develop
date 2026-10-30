import { DomainActionFinder } from '../../index.js';

export class ActionDeleter {
    /**
     * @type {DomainActionFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {KnexActionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionDeleter` class.
     *
     * @param {KnexActionRepository} repository - An instance of the repository that manages Action records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainActionFinder(repository);
    }

    /**
     * Deletes an `Action` object from the repository.
     *
     * This method finds the Action entity by its ID, applies deletion operations, updates the repository with the modified entity, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the Action entity to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `Action` object (e.g., deleted_by, deleted_at).
     * @returns {Promise<void>} A promise that resolves when the `Action` entity is deleted.
     * @throws {Error} Throws an error if the Action entity does not exist.
     */
    async execute(id, dto) {
        const action = await this.#finder.execute(id);

        if (!action) {
            throw new Error(`Action with ID ${id} does not exist.`);
        }

        const originalValues = action.toJson();
        action.delete(dto);

        await this.#repository.update(action);
        await this.#repository.saveHistory(action, originalValues);
        action.flushChanges();
    }
}
