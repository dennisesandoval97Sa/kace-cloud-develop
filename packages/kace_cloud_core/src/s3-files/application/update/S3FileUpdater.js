import { DomainS3FileFinder } from '../../index.js';

export class S3FileUpdater {
    /** @type {DomainS3FileFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexS3FileRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `S3FileUpdater` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages S3 file records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainS3FileFinder(repository);
    }

    /**
     * Updates an `S3File` object in the repository.
     *
     * @param {string} id - The unique identifier of the `S3File` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `S3File` object.
     * @returns {Promise<void>} A promise that resolves when the `S3File` object is updated.
     */
    async execute(id, dto) {
        const s3File = await this.#finder.execute(id);

        if (!s3File) {
            throw new Error(`S3 file with ID ${id} does not exist.`);
        }

        const originalValues = s3File.toJson();
        s3File.update(dto);

        await this.#repository.update(s3File);
        await this.#repository.saveHistory(s3File, originalValues);

        s3File.flushChanges();
    }
}
