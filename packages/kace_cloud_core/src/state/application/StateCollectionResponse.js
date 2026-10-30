import { StateResponse } from './StateResponse.js';

export class StateCollectionResponse {
    /** @type {State[]} is initialized in the constructor */
    #stateCollection;

    /** @type {number} is initialized in the constructor */
    #count;

    constructor(stateCollection, count) {
        this.#stateCollection = stateCollection;
        this.#count = count;
    }

    /**
     *
     * @returns {StateResponse[]} An array of {@link StateResponse} objects.
     */
    toJson() {
        return {
            data: {
                items: this.#stateCollection.map((state) => new StateResponse(state).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
