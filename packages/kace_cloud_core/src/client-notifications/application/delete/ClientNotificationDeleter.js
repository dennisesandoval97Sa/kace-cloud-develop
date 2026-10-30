import { DomainClientNotificationFinder } from '../../index.js';

export class ClientNotificationDeleter {
    /** @type {KnexClientNotificationRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainClientNotificationFinder} is initialized in the constructor */
    #notificationFinder;

    /**
     * Creates an instance of `ClientNotificationDeleter`.
     *
     * @param {KnexClientNotificationRepository} repository - The repository used to access the `ClientNotification` data.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#notificationFinder = new DomainClientNotificationFinder(repository);
    }

    /**
     * Deletes a `ClientNotification` object from the repository.
     *
     * This method first retrieves the `ClientNotification` object from the repository using the provided `id`.
     * If the object is found, it marks the object as deleted by setting relevant properties in the DTO.
     * Finally, it persists the changes to the repository and flushes any pending changes.
     *
     * @param {string} id - The unique identifier of the `ClientNotification` object to delete.
     * @param {Object} dto - The data transfer object containing the properties to update for the `ClientNotification` object before deletion.
     * @returns {Promise<void>} A promise that resolves when the `ClientNotification` object is marked as deleted.
     */
    async execute(id, dto) {
        const notification = await this.#notificationFinder.execute(id);

        if (!notification) {
            throw new Error(`ClientNotification with ID ${id} does not exist.`);
        }

        const originalValues = notification.toJson();
        notification.delete(dto);

        await this.#repository.update(notification);
        await this.#repository.saveHistory(notification, originalValues);

        notification.flushChanges();
    }
}
