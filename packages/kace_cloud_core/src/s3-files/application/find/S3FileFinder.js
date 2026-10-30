import { CustomError } from '../../../shared/index.js';
import { DomainS3FileFinder, S3FileResponse } from '../../index.js';

export class S3FileFinder {
    /** @type {DomainS3FileFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `S3FileFinder` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages S3 file records.
     */
    constructor(repository) {
        this.#finder = new DomainS3FileFinder(repository);
    }

    /**
     * Executes the finding of an `S3File` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `S3File` object to find.
     * @returns {Promise<S3FileResponse>} A promise that resolves to an `S3FileResponse` object containing the found file data.
     */
    async execute(id) {
        const s3File = await this.#finder.execute(id);
        if (!s3File || s3File.isDeleted()) {
            throw new CustomError('S3 File not found', 404);
        }

        return new S3FileResponse(s3File);
    }
}
