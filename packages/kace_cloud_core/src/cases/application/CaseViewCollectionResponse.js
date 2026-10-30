import { CaseViewResponse } from './CaseViewResponse.js';

export class CaseViewCollectionResponse {
    /**
     * @type {CaseViewResponse[]}
     * is initialized in the constructor
     */
    #caseViewCollection;
    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    /**
     * @type {Array<{status: string, count: number, color: string|null}>}
     * is initialized in the constructor
     */
    #countByStatus;

    /**
     * Creates an instance of ViewCasesCollectionResponse.
     *
     * @param {CaseViewResponse[]} caseViewCollection - An array of ViewCases instances.
     * @param {number} count - The total count of ViewCases items.
     * @param {Array<{status: string, count: number, color: string|null}>} countByStatus - Count per status.
     */
    constructor(caseViewCollection, count, countByStatus = []) {
        this.#caseViewCollection = caseViewCollection;
        this.#count = count;
        this.#countByStatus = countByStatus;
    }

    /**
     * Converts the collection to a JSON representation.
     *
     * @returns {Object} An object containing the ViewCases data and metadata.
     */
    toJson() {
        return {
            data: {
                items: this.#caseViewCollection.map((caseView) => new CaseViewResponse(caseView).toJson().data),
            },
            metadata: {
                count: this.#count,
                countByStatus: this.#countByStatus,
            },
        };
    }
}
