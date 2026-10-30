import { CaseDescriptionResponse } from './CaseDescriptionResponse';

export class CaseDescriptionCollectionResponse {
    /**
     * @type {CaseDescription[]}
     * is initialized in the constructor
     */
    #caseDescriptionCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `CaseDescriptionCollectionResponse`.
     *
     * @param {CaseDescription[]} caseDescriptionCollection - An array of `CaseDescription` instances.
     * @param {number} count - The total count of entities in the collection.
     */
    constructor(caseDescriptionCollection, count) {
        this.#caseDescriptionCollection = caseDescriptionCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of `CaseDescription` objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the `CaseDescription` data.
     */
    toJson() {
        return {
            data: {
                items: this.#caseDescriptionCollection.map(
                    (description) => new CaseDescriptionResponse(description).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
