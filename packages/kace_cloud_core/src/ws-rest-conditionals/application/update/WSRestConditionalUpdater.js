import { CustomError } from '../../../shared/errors/CustomError.js';
import { DomainWSRestConditionalFinder } from '../../index.js';

export class WSRestConditionalUpdater {
    /** @type {KnexWSRestConditionalRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainWSRestConditionalFinder} is initialized in the constructor */
    #conditionalFinder;

    /**
     * Creates an instance of the `WSRestConditionalUpdater` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages WS REST conditionals.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#conditionalFinder = new DomainWSRestConditionalFinder(repository);
    }

    /**
     * Updates a WSRestConditional object in the repository.
     *
     * @param {string} id - The unique identifier of the WSRestConditional object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the WSRestConditional object.
     * @returns {Promise<void>} A promise that resolves when the WSRestConditional object is updated.
     */
    async execute(id, dto) {
        const wsRestConditional = await this.#conditionalFinder.execute(id);

        if (!wsRestConditional) {
            throw new CustomError(`WSRestConditional with id ${id} does not exist.`, 404);
        }

        const originalValues = wsRestConditional.toJson();
        wsRestConditional.update(dto);

        await this.#repository.update(wsRestConditional);

        wsRestConditional.flushChanges();
    }
}
