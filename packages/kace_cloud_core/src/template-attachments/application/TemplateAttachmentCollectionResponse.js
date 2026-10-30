import { TemplateAttachmentResponse } from './TemplateAttachmentResponse.js';

export class TemplateAttachmentCollectionResponse {
    /** @type {TemplateAttachment[]} is initialized in the constructor */
    #TemplateAttachmentCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of TemplateAttachmentCollectionResponse.
     *
     * @param {TemplateAttachment[]} TemplateAttachmentCollection - An array of TemplateAttachment instances.
     * @param {number} count - The total count of TemplateAttachment items.
     */
    constructor(TemplateAttachmentCollection, count) {
        this.#TemplateAttachmentCollection = TemplateAttachmentCollection;
        this.#count = count;
    }

    /**
     * Converts the TemplateAttachment collection to a JSON representation.
     *
     * @returns {Object} An object containing the collection of TemplateAttachment data and the total count.
     */
    toJson() {
        return {
            data: {
                items: this.#TemplateAttachmentCollection.map(
                    (TemplateAttachment) => new TemplateAttachmentResponse(TemplateAttachment).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
