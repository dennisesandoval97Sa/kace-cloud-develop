import { DomainActionUpdateModelFinder } from '../../index.js';

export class ActionUpdateModelUpdater {
    /**
     * @type {DomainActionUpdateModelFinder}
     * is initialized in the constructor
     */
    #modelUpdateFinder;

    /**
     * @type {KnexActionUpdateModelRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionUpdateModelUpdater` class.
     *
     * @param {KnexActionUpdateModelRepository} repository - An instance of the repository that manages ActionUpdateModel records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#modelUpdateFinder = new DomainActionUpdateModelFinder(repository);
    }

    /**
     * Updates a `ActionUpdateModel` object in the repository.
     *
     * @param {string} id - The unique identifier of the `ActionUpdateModel` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `ActionUpdateModel` object.
     * @returns {Promise<void>} A promise that resolves when the `ActionUpdateModel` object is updated.
     */
    async execute(id, dto) {
        const modelUpdate = await this.#modelUpdateFinder.execute(id);

        if (!modelUpdate) {
            throw new Error(`ActionUpdateModel with ID ${id} does not exist.`);
        }

        const originalValues = modelUpdate.toJson();

        modelUpdate.update(dto);

        await this.#repository.update(modelUpdate);
        await this.#repository.saveHistory(modelUpdate, originalValues);

        modelUpdate.flushChanges();
    }
}
