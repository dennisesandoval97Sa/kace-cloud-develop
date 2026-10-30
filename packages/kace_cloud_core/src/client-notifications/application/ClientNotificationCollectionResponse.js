import { ClientNotificationResponse } from './ClientNotificationResponse';

export class ClientNotificationCollectionResponse {
    /** @type {ClientNotification[]} is initialized in the constructor */
    #clientNotificationCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Constructs a new instance of ClientNotificationCollectionResponse.
     * @param {ClientNotification[]} clientNotificationCollection - The repository used to count client notifications.
     * @param count
     */
    constructor(clientNotificationCollection, count) {
        this.#clientNotificationCollection = clientNotificationCollection;
        this.#count = count;
    }

    /**
     * Converts the ClientNotification object to a JSON representation.
     *
     * @returns {Object} A plain object containing the ClientNotification data.
     */
    toJson() {
        return {
            data: {
                items: this.#clientNotificationCollection.map(
                    (clientNotification) => new ClientNotificationResponse(clientNotification).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
