import { HelpsFinderDomain } from '../../index';
import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';

export class HelpsUpdater {
    /** @type {KnexHelpsRepository} is initialized in the constructor*/
    #repository;

    /** @type {HelpsFinder} is initialized in the constructor*/
    #finder;

    /** @type {UniquenessValidator} is initialized in the constructor*/
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new HelpsFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates an Helps object in the repository.
     *
     * @param {string} id - The unique identifier of the Helps object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the Helps object.
     * @returns {Promise<void>} A promise that resolves when the Helps object is updated.
     */
    async execute(dto, id) {
        const help = await this.#finder.execute(id);

        if (!help) {
            throw new CustomError(`Helps with id ${id} does not exist.`, 404);
        }
        if (dto.titulo) {
            await this.#uniquenessValidator.validate('titulo', dto.titulo, id);
        }

        const originalValues = help.toJson();
        help.update(dto);

        await this.#repository.update(help);
        await this.#repository.saveHistory(help, originalValues);

        help.flushChanges();
    }
}
