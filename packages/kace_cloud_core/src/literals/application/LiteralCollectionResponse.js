import { LiteralResponse } from './LiteralResponse';

export class LiteralCollectionResponse {
    /** @type {Literal[]} is initialized in the constructor */
    #literalCollection;

    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Constructs a new instance of `LiteralCollectionResponse`.
     * @param {Literal[]} literalCollection - The collection of `Literal` objects.
     */
    constructor(literalCollection, count) {
        this.#literalCollection = literalCollection;
        this.#count = count;
    }

    /**
     * Converts the `Literal` collection to a JSON representation.
     *
     * @returns {Object} An array of plain objects, each representing a `Literal`.
     */
    toJson() {
        return {
            data: {
                items: this.#literalCollection.map((literal) => new LiteralResponse(literal).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
