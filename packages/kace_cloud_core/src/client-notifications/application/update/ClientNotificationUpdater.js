import { DomainClientNotificationFinder } from '../../index.js';

export class ClientNotificationUpdater {
    /** @type {DomainClientNotificationFinder} is initialized in the constructor */
    #notificationFinder;
    /** @type {KnexClientNotificationRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of `ClientNotificationUpdater`.
     *
     * @param {KnexClientNotificationRepository} repository - The repository used to access the `ClientNotification` data.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#notificationFinder = new DomainClientNotificationFinder(repository);
    }

    /**
     * Executes the update operation for a `ClientNotification` object in the repository.
     *
     * @param {string} id - The unique identifier of the `ClientNotification` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `ClientNotification` object.
     * @returns {Promise<void>} A promise that resolves when the `ClientNotification` object is successfully updated.
     */
    async execute(id, dto) {
        const notification = await this.#notificationFinder.execute(id);

        if (!notification) {
            throw new Error(`ClientNotification with ID ${id} does not exist.`);
        }

        const originalValues = notification.toJson();
        notification.update(dto);

        await this.#repository.update(notification);
        await this.#repository.saveHistory(notification, originalValues);

        notification.flushChanges();
    }
}
