import { UserNotificationResponse } from './UserNotificationResponse';

export class UserNotificationCollectionResponse {
    /** @type {UserNotification[]} is initialized in the constructor */
    #userNotificationCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `UserNotificationCollectionResponse`.
     *
     * @param {UserNotification[]} userNotificationCollection - An array of `UserNotification` instances.
     * @param {number} count - The total count of Action items.
     */
    constructor(userNotificationCollection, count) {
        this.#userNotificationCollection = userNotificationCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of `UserNotification` objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the `UserNotification` data.
     */
    toJson() {
        return {
            data: {
                items: this.#userNotificationCollection.map(
                    (notification) => new UserNotificationResponse(notification).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
