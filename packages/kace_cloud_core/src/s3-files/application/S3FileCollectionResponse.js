import { S3FileResponse } from './S3FileResponse';

export class S3FileCollectionResponse {
    /** @type {S3File[]} is initialized in the constructor */
    #s3FileCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of `S3FileCollectionResponse`.
     *
     * @param {S3File[]} s3FileCollection - An array of `S3File` instances.
     */
    constructor(s3FileCollection, count) {
        this.#s3FileCollection = s3FileCollection;
        this.#count = count;
    }

    /**
     * Converts the collection of `S3File` objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the `S3File` data.
     */
    toJson() {
        return {
            data: {
                items: this.#s3FileCollection.map((file) => new S3FileResponse(file).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
