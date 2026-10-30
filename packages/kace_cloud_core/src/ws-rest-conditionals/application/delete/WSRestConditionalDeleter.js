import { DomainWSRestConditionalFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class WSRestConditionalDeleter {
    /** @type {KnexWSRestConditionalRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainWSRestConditionalFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `WSRestConditionalDeleter` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages WS REST conditionals.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainWSRestConditionalFinder(repository);
    }

    /**
     * Deletes a WSRestConditional object from the repository.
     *
     * @param {string} id - The unique identifier of the WSRestConditional object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the deletion process.
     * @returns {Promise<void>} A promise that resolves when the WSRestConditional object is deleted.
     */
    async execute(id, dto) {
        const wsRestConditional = await this.#finder.execute(id);

        if (!wsRestConditional) {
            throw new CustomError(`WSRestConditional with id ${id} does not exist.`, 404);
        }

        wsRestConditional.delete(dto);

        await this.#repository.delete(wsRestConditional);

        wsRestConditional.flushChanges();
    }
}
