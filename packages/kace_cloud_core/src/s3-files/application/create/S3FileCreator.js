import { S3File } from '../../index';

export class S3FileCreator {
    /** @type {KnexS3FileRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of `S3FileCreator`.
     *
     * @param {KnexS3FileRepository} repository - The repository used to save S3 files.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the process of creating a new S3 file.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `S3File` object, and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `S3File` object.
     * @returns {Promise<void>} A promise that resolves when the `S3File` object is successfully created.
     */
    async execute(dto) {
        const s3File = S3File.create(dto);

        await this.#repository.save(s3File);
        await this.#repository.saveHistory(s3File);
    }
}
