import { DomainAllowedConnectionFinder } from '../../index.js';

export class AllowedConnectionDeleter {
    /**
     * @type {KnexAllowedConnectionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAllowedConnectionFinder}
     * is initialized in the constructor
     */
    #connectionFinder;

    /**
     * Creates an instance of `AllowedConnectionDeleter`.
     *
     * @param {KnexAllowedConnectionRepository} repository - The repository used to access the `AllowedConnection` data.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#connectionFinder = new DomainAllowedConnectionFinder(repository);
    }

    /**
     * Deletes an `AllowedConnection` object from the repository.
     *
     * This method first retrieves the `AllowedConnection` object from the repository using the provided `id`.
     * If the object is found, it marks the object as deleted by setting relevant properties in the DTO.
     * Finally, it persists the changes to the repository and flushes any pending changes.
     *
     * @param {string} id - The unique identifier of the `AllowedConnection` object to delete.
     * @param {Object} dto - The data transfer object containing the properties to update for the `AllowedConnection` object before deletion.
     * @returns {Promise<void>} A promise that resolves when the `AllowedConnection` object is marked as deleted.
     */
    async execute(id, dto) {
        const allowedConnection = await this.#connectionFinder.execute(id);

        if (!allowedConnection) {
            throw new Error(`AllowedConnection with ID ${id} does not exist.`);
        }

        const originalValues = allowedConnection.toJson();
        allowedConnection.delete(dto);

        await this.#repository.update(allowedConnection);
        await this.#repository.saveHistory(allowedConnection, originalValues);

        allowedConnection.flushChanges();
    }
}
