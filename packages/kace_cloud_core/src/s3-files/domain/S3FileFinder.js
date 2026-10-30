import { ValueObjectUuid } from '../../shared/index.js';

export class S3FileFinder {
    /** @type {KnexS3FileRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `S3FileFinder` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages S3 file records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds an S3 file by its ID.
     *
     * @param {string} id - The UUID of the S3 file to find.
     * @return {Promise<S3File | null>} A promise that resolves to the `S3File` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
