import { S3ImportsCollectionResponse } from '../S3ImportsCollectionResponse';

export class S3ImportsDashboard {
    /** @type {KnexS3FileRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of `S3ImportsDashboard`.|
     *
     * @param {KnexS3FileRepository} repository - The repository used to register S3 import files.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the query to retrieve S3 import files for a user.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `S3ImportFile` object, and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `S3ImportFile` object.
     * @returns {Promise<void>} A promise that resolves when the `S3ImportFile` object is successfully created.
     */
    async execute(id) {
        const rows = await this.#repository.findImportsByUser(id);

        return new S3ImportsCollectionResponse(rows);
    }
}
