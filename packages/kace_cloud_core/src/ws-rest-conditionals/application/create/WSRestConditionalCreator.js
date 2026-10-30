import { CustomError } from '../../../shared/errors/CustomError';
import { DomainWSRestConditionalFinder, WSRestConditional } from '../../index';

export class WSRestConditionalCreator {
    /** @type {KnexWSRestConditionalRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainWSRestConditionalFinder} is initialized in the constructor */
    #conditionalFinder;

    /**
     * Creates an instance of `WSRestConditionalCreator`.
     *
     * @param {KnexS3FileRepository} repository - The repository used to save WS REST conditionals.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#conditionalFinder = new DomainWSRestConditionalFinder(repository);
    }

    /**
     * Executes the creation of a WSRestConditional object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the WSRestConditional object.
     * @returns {Promise<void>} A promise that resolves when the WSRestConditional object is saved.
     */
    async execute(dto) {
        const wsRestConditional = WSRestConditional.create(dto);

        const result = await this.#conditionalFinder.execute(wsRestConditional.id.value);
        if (result) {
            throw new CustomError(`WSRestConditional with id ${wsRestConditional.id.value} already exists`, 400);
        }

        await this.#repository.save(wsRestConditional);
    }
}
