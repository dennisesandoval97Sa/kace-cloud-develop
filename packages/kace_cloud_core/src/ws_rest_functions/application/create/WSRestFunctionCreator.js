import { WSRestFunction } from '../../domain/WSRestFunction.js';
import { WSRestFunctionFinder as DomainWSRestFunctionFinder } from '../../domain/WSRestFunctionFinder.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';

export class WSRestFunctionCreator {
    /**
     * @type {KnexWSRestFunctionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainWSRestFunctionFinder}
     * is initialized in the constructor
     */
    #restFunctionFinder;

    /**
     * @type {UniquenessValidator}
     * is initialized in the constructor
     */
    #uniquenessValidator;

    /**
     * @param {KnexWSRestFunctionRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#restFunctionFinder = new DomainWSRestFunctionFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the creation of an RestFunction object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the RestFunction object.
     * @returns {Promise<void>} A promise that resolves when the RestFunction object is saved.
     */
    async execute(dto) {
        const restFunction = await this.#restFunctionFinder.execute(dto.id);
        if (restFunction) {
            throw new ValidationFailError('RestFunction already exists.', 'id');
        }
        await this.#uniquenessValidator.validate('description', dto.description);
        const newRestFunction = WSRestFunction.create(dto);
        await this.#repository.save(newRestFunction);
    }
}
