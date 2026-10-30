import { WSRestConditionalResponse } from './WSRestConditionalResponse';

export class WSRestConditionalCollectionResponse {
    /** @type {WSRestConditional[]} is initialized in the constructor */
    #wsRestConditionalCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `WSRestConditionalCollectionResponse`.
     *
     * @param {WSRestConditional[]} wsRestConditionalCollection - An array of `WSRestConditional` instances.
     * @param {number} count - The total count of Action items.
     */
    constructor(wsRestConditionalCollection, count) {
        this.#wsRestConditionalCollection = wsRestConditionalCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of `WSRestConditional` objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the `WSRestConditional` data.
     */
    toJson() {
        return {
            data: {
                items: this.#wsRestConditionalCollection.map(
                    (conditional) => new WSRestConditionalResponse(conditional).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
