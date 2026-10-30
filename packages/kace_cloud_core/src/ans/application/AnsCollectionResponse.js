import { AnsResponse } from './AnsResponse.js';

export class AnsCollectionResponse {
    /** @type {Ans[]} is initialized in the constructor */
    #ansCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(ansCollection, count) {
        this.#ansCollection = ansCollection;
        this.#count = count;
    }

    /**
     * Converts the Ans object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Ans data.
     */
    toJson() {
        return {
            data: {
                items: this.#ansCollection.map((ans) => new AnsResponse(ans).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
