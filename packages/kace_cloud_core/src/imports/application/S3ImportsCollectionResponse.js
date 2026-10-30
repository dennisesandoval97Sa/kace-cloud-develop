export class S3ImportsCollectionResponse {
    /** @type {S3ImportFile[]} is initialized in the constructor */
    #s3ImportsCollection;

    /**
     * Creates an instance of `S3FileCollectionResponse`.
     *
     * @param {S3ImportFile[]} s3FileCollection - An array of `S3ImportFile` instances.
     */
    constructor(s3FileCollection) {
        this.#s3ImportsCollection = s3FileCollection;
    }

    /**
     * Converts the collection of `S3ImportFile` objects to a JSON representation.
     *
     * @returns {Object[]} An array of plain objects containing the `S3ImportFile` data.
     */
    toJson() {
        return {
            data: {
                items: this.#s3ImportsCollection.map((file) => {
                    return {
                        id: file.id.value,
                        file_path: file.file_path.value,
                        status: file.status.value,
                        upload_attempts: file.upload_attempts.value,
                        total_records: file.total_records.value,
                        processed_records: file.processed_records.value,
                        last_updated_at: file.last_updated_at.value,
                        error_details: file.error_details.value,
                        target_table: file.target_table.value,
                        created_at: file.created_at.value,
                        created_by: file.created_by.value,
                    };
                }),
            },
            metadata: {},
        };
    }
}
