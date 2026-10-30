import { ActionUpdateModelResponse } from './ActionUpdateModelResponse.js';

export class ActionUpdateModelCollectionResponse {
    /**
     * @type {ModelUpdate[]}
     * is initialized in the constructor
     */
    #modelUpdates;
    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of ModelUpdateCollectionResponse.
     *
     * @param {ModelUpdate[]} modelUpdateCollection - An array of ModelUpdate instances.
     * @param {number} count - The total count of ModelUpdate items.
     */
    constructor(modelUpdates, count) {
        this.#modelUpdates = modelUpdates;
        this.#count = count;
    }

    /**
     * Converts the collection to a JSON representation.
     *
     * @returns {Object} An object containing the ModelUpdate data and metadata.
     */
    toJson() {
        return {
            data: {
                items: this.#modelUpdates.map(
                    (modelUpdate) => new ActionUpdateModelResponse(modelUpdate).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
