import { ActionUpdateModel, DomainActionUpdateModelFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';

export class ActionUpdateModelCreator {
    /**
     * @type {KnexActionUpdateModelRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainActionUpdateModelFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {UniquenessValidator}
     * is initialized in the constructor
     */
    #uniquenessValidator;

    /**
     * @param {KnexActionUpdateModelRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainActionUpdateModelFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the process of creating a new model update.
     * @param {Object} dto - The data transfer object containing the properties for the ActionUpdateModel object.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        if (!dto) throw new Error('dto cannot be null or undefined');

        const modelUpdate = new ActionUpdateModel(dto);

        const result = await this.#finder.execute(modelUpdate.id.value);
        if (result) {
            throw new CustomError(`ActionUpdateModel with id ${modelUpdate.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('description', dto.description);

        await this.#repository.save(modelUpdate);
        await this.#repository.saveHistory(modelUpdate);
    }
}
