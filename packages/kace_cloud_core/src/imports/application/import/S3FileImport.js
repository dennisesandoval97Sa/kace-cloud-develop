import { S3ImportFile } from '../../domain/S3ImportFile';
import { InvalidTargetTableError } from '../../domain/errors/InvalidTargetTableError';

export class S3FileImport {
    /** @type {KnexS3FileRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of `S3FileImport`.|
     *
     * @param {KnexS3FileRepository} repository - The repository used to register S3 import files.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the process of regiter a new S3 import file.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `S3ImportFile` object, and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `S3ImportFile` object.
     * @returns {Promise<string>} A promise that resolves to the persisted S3ImportFile id.
     */
    async execute(dto) {
        const s3ImportFile = S3ImportFile.create(dto);
        const tables = (await this.#repository.getSchemaTables()) || [];
        if (!tables.includes(s3ImportFile.target_table.value)) {
            throw new InvalidTargetTableError(s3ImportFile.target_table.value);
        }
        await this.#repository.save(s3ImportFile);
        return s3ImportFile.id.value;
    }
}
