import { WSRestFunctionResponse } from './WSRestFunctionResponse.js';

export class WSRestFunctionCollectionResponse {
    /**
     * @type { WSRestFunction[] }
     * is initialized in the constructor
     */
    #restFunctions;

    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    /**
     *
     * @param {Array<WSRestFunction>}  restFunctions
     * @param count
     */
    constructor(restFunctions, count) {
        this.#restFunctions = restFunctions;
        this.#count = count;
    }

    /**
     * Converts the collection of RestFunction objects to a JSON format.
     *
     * @returns {Object} The collection of RestFunction objects in JSON format.
     */
    toJson() {
        return {
            data: {
                items: this.#restFunctions.map(
                    (restFunction) => new WSRestFunctionResponse(restFunction).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
