import { DomainActionUpdateModelFinder } from '../../index.js';

export class ActionUpdateModelDeleter {
    /**
     * @type {DomainActionUpdateModelFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {KnexActionModelUpdateRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionUpdateModelDeleter` class.
     *
     * @param {KnexActionModelUpdateRepository} repository - An instance of the repository that manages ActionUpdateModel records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainActionUpdateModelFinder(repository);
    }

    /**
     * Deletes a `ActionUpdateModel` object from the repository.
     *
     * This method finds the ActionUpdateModel entity by its ID, applies deletion operations, updates the repository with the modified entity, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the ActionUpdateModel entity to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `ActionUpdateModel` object (e.g., deleted_by, deleted_at).
     * @returns {Promise<void>} A promise that resolves when the `ActionUpdateModel` entity is deleted.
     * @throws {Error} Throws an error if the ActionUpdateModel entity does not exist.
     */
    async execute(id, dto) {
        const modelUpdate = await this.#finder.execute(id);

        if (!modelUpdate) {
            throw new Error(`ActionUpdateModel with ID ${id} does not exist.`);
        }

        const originalValues = modelUpdate.toJson();
        modelUpdate.delete(dto);

        await this.#repository.update(modelUpdate);
        await this.#repository.saveHistory(modelUpdate, originalValues);

        modelUpdate.flushChanges();
    }
}
