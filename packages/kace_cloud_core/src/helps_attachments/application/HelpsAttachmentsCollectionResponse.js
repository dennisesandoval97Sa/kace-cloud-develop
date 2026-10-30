import { HelpsAttachmentsResponse } from './HelpsAttachmentsResponse';

export class HelpsAttachmentsCollectionResponse {
    /**@type {Helps[]} is initialized in the constructor */
    #helpsAttachmentsCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(helpsAttachmentsCollection, count) {
        this.#helpsAttachmentsCollection = helpsAttachmentsCollection;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#helpsAttachmentsCollection.map(
                    (helps) => new HelpsAttachmentsResponse(helps).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
