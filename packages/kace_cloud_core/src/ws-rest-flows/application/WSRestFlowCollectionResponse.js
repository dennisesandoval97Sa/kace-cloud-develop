import { WSRestFlowResponse } from './WSRestFlowResponse';

export class WSRestFlowCollectionResponse {
    /** @type {WSRestFlow[]} is initialized in the constructor */
    #wsRestFlowCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `WSRestFlowCollectionResponse`.
     *
     * @param {WSRestFlow[]} wsRestFlowCollection - An array of `WSRestFlow` instances.
     * @param {number} count - The total count of WS REST flows.
     */
    constructor(wsRestFlowCollection, count) {
        this.#wsRestFlowCollection = wsRestFlowCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of `WSRestFlow` objects to a JSON representation.
     *
     * @returns {Object} An object containing the `data` array of flow data and `metadata`.
     */
    toJson() {
        return {
            data: {
                items: this.#wsRestFlowCollection.map((flow) => new WSRestFlowResponse(flow).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
