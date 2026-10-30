import { CustomError } from '../../../shared/index.js';
import { DomainUserNotificationFinder, UserNotificationResponse } from '../../index.js';

export class UserNotificationFinder {
    /** @type {DomainUserNotificationFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `UserNotificationFinder` class.
     *
     * @param {KnexUserNotificationRepository} repository - An instance of the repository that manages user notification records.
     */
    constructor(repository) {
        this.#finder = new DomainUserNotificationFinder(repository);
    }

    /**
     * Executes the finding of a `UserNotification` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `UserNotification` object to find.
     * @returns {Promise<UserNotificationResponse>} A promise that resolves to a `UserNotificationResponse` object containing the found notification data.
     */
    async execute(id) {
        const userNotification = await this.#finder.execute(id);
        if (!userNotification || userNotification.isDeleted()) {
            throw new CustomError('User notification not found', 404);
        }

        return new UserNotificationResponse(userNotification);
    }
}
