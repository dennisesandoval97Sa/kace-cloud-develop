import { WSRestFunctionFinder as DomainWSRestFunctionFinder } from '../../domain/WSRestFunctionFinder.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';

export class WSRestFunctionUpdater {
    /**
     * @type {DomainWSRestFunctionFinder} is initialized in the constructor
     */
    #restFunctionFinder;

    /**
     * @type {KnexWSRestFunctionRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {UniquenessValidator}
     * is initialized in the constructor
     */
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#restFunctionFinder = new DomainWSRestFunctionFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the updating of an RestFunction object and saves it to the repository.
     *
     * @param {string} id - The id of the RestFunction object to update.
     * @param {Object} dto - The data transfer object containing the properties to update the RestFunction object.
     *
     * @returns {Promise<void>} A promise that resolves when the RestFunction object is updated.
     */
    async execute(id, dto) {
        const restFunctionFinder = await this.#restFunctionFinder.execute(id);

        if (!restFunctionFinder) {
            throw new ValidationFailError('RestFunction not found.', 'id');
        }
        if (dto.description) {
            await this.#uniquenessValidator.validate('description', dto.description, id);
        }
        restFunctionFinder.update(dto);
        await this.#repository.update(restFunctionFinder);
        restFunctionFinder.flushChanges();
    }
}
