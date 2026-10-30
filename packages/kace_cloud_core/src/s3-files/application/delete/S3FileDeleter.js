import { DomainS3FileFinder } from '../../index.js';

export class S3FileDeleter {
    /** @type {DomainS3FileFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexS3FileRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `S3FileDeleter` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages S3 file records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainS3FileFinder(repository);
    }

    /**
     * Deletes an `S3File` object from the repository.
     *
     * This method finds the S3 file by its ID, applies deletion operations, updates the repository with the modified S3 file object, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the S3 file object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `S3File` object.
     * @returns {Promise<void>} A promise that resolves when the `S3File` object is deleted.
     * @throws {Error} Throws an error if the S3 file object does not exist.
     */
    async execute(id, dto) {
        const s3File = await this.#finder.execute(id);

        if (!s3File) {
            throw new Error(`S3 file with ID ${id} does not exist.`);
        }

        const originalValues = s3File.toJson();
        s3File.delete(dto);

        await this.#repository.update(s3File);
        await this.#repository.saveHistory(s3File, originalValues);

        s3File.flushChanges();
    }
}
