export class S3FileResponse {
    /** @type {S3File} is initialized in the constructor */
    #s3File;

    /**
     * Creates an instance of `S3FileResponse`.
     *
     * @param {S3File} file - The `S3File` instance.
     */
    constructor(file) {
        this.#s3File = file;
    }

    /**
     * Converts the `S3File` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the S3 file data.
     */
    toJson() {
        if (!this.#s3File) return {};

        return {
            data: {
                id: this.#s3File.id.value,
                description: this.#s3File.description.value,
                file_name: this.#s3File.file_name.value,
                s3_file_name: this.#s3File.s3_file_name.value,
                url: this.#s3File.url.value,
                size: this.#s3File.size.value,
                is_active: this.#s3File.is_active.value,
                origin: this.#s3File.origin.value,
                expired_at: this.#s3File.expired_at.value,
                created_at: this.#s3File.created_at.value,
                created_by: this.#s3File.created_by.value,
                updated_at: this.#s3File.updated_at.value,
                updated_by: this.#s3File.updated_by.value,
            },
        };
    }
}
