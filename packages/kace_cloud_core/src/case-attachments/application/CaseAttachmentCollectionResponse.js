import { CaseAttachmentResponse } from './CaseAttachmentResponse.js';

export class CaseAttachmentCollectionResponse {
    /**
     * @type {CaseAttachment[]}
     * Holds the collection of CaseAttachment instances.
     * Initialized through the constructor.
     */
    #caseAttachmentCollection;

    /**
     * @type {number}
     * Represents the total count of CaseAttachment items.
     * Initialized through the constructor.
     */
    #count;

    /**
     * Creates an instance of CaseAttachmentCollectionResponse.
     *
     * @param {CaseAttachment[]} caseAttachmentCollection - An array of CaseAttachment instances.
     * @param {number} count - The total count of CaseAttachment items.
     */
    constructor(caseAttachmentCollection, count) {
        this.#caseAttachmentCollection = caseAttachmentCollection;
        this.#count = count;
    }

    /**
     * Converts the CaseAttachment collection to a JSON representation.
     *
     * @returns {Object} An object containing the collection of CaseAttachment data and the total count.
     */
    toJson() {
        return {
            data: {
                items: this.#caseAttachmentCollection.map(
                    (caseAttachment) => new CaseAttachmentResponse(caseAttachment).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
