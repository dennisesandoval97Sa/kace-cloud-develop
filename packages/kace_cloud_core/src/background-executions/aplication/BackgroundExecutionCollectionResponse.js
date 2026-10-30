import { BackgroundExecutionResponse } from './BackgroundExecutionResponse';

export class BackgroundExecutionCollectionResponse {
    /** @type {BackgroundExecution[]} is initialized in the constructor */
    #backgroundExecutionCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `WSRestEndpointCollectionResponse`.
     *
     * @param {BackgroundExecution[]} backgroundExecutionCollection - An array of `WSRestEndpoint` instances.
     * @param {number} count - The total count of Action items.
     */
    constructor(backgroundExecutionCollection, count) {
        this.#backgroundExecutionCollection = backgroundExecutionCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of `BackgroundExecution` objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the `BackgroundExecution` data.
     */
    toJson() {
        return {
            data: {
                items: this.#backgroundExecutionCollection.map(
                    (backgroundExecution) => new BackgroundExecutionResponse(backgroundExecution).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
