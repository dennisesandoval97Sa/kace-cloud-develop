import { ValueObjectUuid } from '../../shared/index.js';

export class UserNotificationFinder {
    /** @type {KnexNotificationRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `NotificationFinder` class.
     *
     * @param {KnexUserNotificationRepository} repository - An instance of the repository that manages notification records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a user notification by their ID.
     *
     * @param {string} id - The UUID of the notification to find.
     * @return {Promise<notification | null>} A promise that resolves to the `UserNotification` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
