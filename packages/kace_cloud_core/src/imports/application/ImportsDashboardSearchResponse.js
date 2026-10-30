import { S3ImportsCollectionResponse } from './S3ImportsCollectionResponse.js';

export class ImportsDashboardSearchResponse extends S3ImportsCollectionResponse {
    /** @type {number} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of `ImportsDashboardSearchResponse`.
     *
     * @param {S3ImportFile[]} s3FileCollection - An array of `S3ImportFile` instances.
     * @param {number} counter - The total count of records matching the search criteria.
     */
    constructor(s3FileCollection, counter) {
        super(s3FileCollection);
        this.#counter = counter;
    }

    /**
     * Converts the collection of `S3ImportFile` objects to a JSON representation
     * including the counter in metadata.
     *
     * @returns {Object} An object containing the data and metadata with counter.
     */
    toJson() {
        const baseResponse = super.toJson();

        return {
            ...baseResponse,
            metadata: {
                ...baseResponse.metadata,
                count: this.#counter,
            },
        };
    }

    /**
     * Gets the counter value.
     *
     * @returns {number} The total count of records.
     */
    get counter() {
        return this.#counter;
    }
}
