import { AllowedConnectionResponse } from './AllowedConnectionResponse';

export class AllowedConnectionCollectionResponse {
    /**
     * @type {AllowedConnection[]}
     * is initialized in the constructor
     */
    #allowedConnectionCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Constructs a new instance of AllowedConnectionResponse.
     * @param {AllowedConnection[]} allowedConnectionCollection - The repository used to count allowed connections.
     */
    constructor(allowedConnectionCollection, count) {
        this.#allowedConnectionCollection = allowedConnectionCollection;
        this.#count = count;
    }

    /**
     * Converts the AllowedConnection object to a JSON representation.
     *
     * @returns {Object} A plain object containing the AllowedConnection data.
     */
    toJson() {
        return {
            data: {
                items: this.#allowedConnectionCollection.map(
                    (allowedConnection) => new AllowedConnectionResponse(allowedConnection).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
