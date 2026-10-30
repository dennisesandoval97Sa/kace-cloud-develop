import { EventResponse } from './EventResponse';

export class EventCollectionResponse {
    /** @type {Client[]} is initialized in the constructor*/
    #clientCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(clientCollection, count) {
        this.#clientCollection = clientCollection;
        this.#count = count;
    }

    /**
     * Converts the Client object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Client data.
     */
    toJson() {
        return {
            data: {
                items: this.#clientCollection.map((client) => new EventResponse(client).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
