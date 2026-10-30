import { DomainUserNotificationFinder } from '../../index.js';

export class UserNotificationDeleter {
    /** @type {DomainUserNotificationFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexNotificationRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `UserNotificationDeleter` class.
     *
     * @param {KnexNotificationRepository} repository - An instance of the repository that manages user notification records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainUserNotificationFinder(repository);
    }

    /**
     * Deletes a `UserNotification` object from the repository.
     *
     * This method finds the user notification by its ID, applies deletion operations, updates the repository with the modified user notification object, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the user notification object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `UserNotification` object.
     * @returns {Promise<void>} A promise that resolves when the `UserNotification` object is deleted.
     * @throws {Error} Throws an error if the user notification object does not exist.
     */
    async execute(id, dto) {
        const userNotification = await this.#finder.execute(id);

        if (!userNotification) {
            throw new Error(`User notification with ID ${id} does not exist.`);
        }

        const originalValues = userNotification.toJson();
        userNotification.delete(dto);

        await this.#repository.update(userNotification);
        await this.#repository.saveHistory(userNotification, originalValues);

        userNotification.flushChanges();
    }
}
