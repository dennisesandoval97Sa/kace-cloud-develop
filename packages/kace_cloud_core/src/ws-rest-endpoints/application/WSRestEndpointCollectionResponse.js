import { WSRestEndpointResponse } from './WSRestEndpointResponse';

export class WSRestEndpointCollectionResponse {
    /** @type {WSRestEndpoint[]} is initialized in the constructor */
    #wsRestEndpointCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `WSRestEndpointCollectionResponse`.
     *
     * @param {WSRestEndpoint[]} wsRestEndpointCollection - An array of `WSRestEndpoint` instances.
     * @param {number} count - The total count of Action items.
     */
    constructor(wsRestEndpointCollection, count) {
        this.#wsRestEndpointCollection = wsRestEndpointCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of `WSRestEndpoint` objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the `WSRestEndpoint` data.
     */
    toJson() {
        return {
            data: {
                items: this.#wsRestEndpointCollection.map(
                    (endpoint) => new WSRestEndpointResponse(endpoint).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
