import { ActionJobProcessingResponse } from './ActionJobProcessingResponse.js';

export class ActionJobProcessingCollectionResponse {
    /**
     * @type {ActionJobProcessing[]}
     * is initialized in the constructor
     */
    #actionExecutions;
    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of ActionJobProcessingCollectionResponse.
     *
     * @param {ActionJobProcessing[]} actionExecutionCollection - An array of ActionJobProcessing instances.
     * @param {number} count - The total count of ActionJobProcessing items.
     */
    constructor(actionExecutions, count) {
        this.#actionExecutions = actionExecutions;
        this.#count = count;
    }

    /**
     * Converts the collection to a JSON representation.
     *
     * @returns {Object} An object containing the ActionJobProcessing data and metadata.
     */
    toJson() {
        return {
            data: {
                items: this.#actionExecutions.map(
                    (actionExecution) => new ActionJobProcessingResponse(actionExecution).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
