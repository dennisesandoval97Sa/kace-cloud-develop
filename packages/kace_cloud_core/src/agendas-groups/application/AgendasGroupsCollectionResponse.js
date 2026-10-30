import { AgendasGroupsResponse } from './AgendasGroupsResponse';

export class AgendasGroupsCollectionResponse {
    /**
     * @type {AgendasGroups[]} is initialized in the constructor
     */
    #agendasGroupsCollection;

    /**
     * @type {number} is initialized in the constructor
     */
    #count;

    /**
     * @param {AgendasGroups[]} AgendasGroupsCollection
     * @param {number} count
     */
    constructor(AgendasGroupsCollection, count) {
        this.#agendasGroupsCollection = AgendasGroupsCollection;
        this.#count = count;
    }

    /**
     * Convert the collection to JSON format.
     *
     * @returns {Object} - The collection in JSON format.
     */
    toJson() {
        return {
            data: {
                items:
                    this.#agendasGroupsCollection?.map(
                        (agendasGroups) => new AgendasGroupsResponse(agendasGroups).toJson().data
                    ) ?? [],
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
