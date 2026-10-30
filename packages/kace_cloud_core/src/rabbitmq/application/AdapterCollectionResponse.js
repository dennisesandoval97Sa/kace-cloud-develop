import { AdapterResponse } from './AdapterResponse.js';

export class AdapterCollectionResponse {
    /** @type {AdapterResponse[]} is initialized in the constructor */
    #adapterCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `AdapterCollectionResponse`.
     *
     * @param {AdapterResponse[]} adapterCollection - An array of adapter raw objects.
     * @param {number} count - The total count of adapters.
     */
    constructor(adapterCollection, count) {
        this.#adapterCollection = adapterCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of adapters to a JSON representation.
     *
     * @returns {Object} An object containing the `data` array of adapter data and `metadata`.
     */
    toJson() {
        return {
            data: {
                items: this.#adapterCollection.map((adapter) => new AdapterResponse(adapter).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
