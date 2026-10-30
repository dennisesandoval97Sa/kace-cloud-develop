import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { DomainTemplateFinder } from '../../index.js';

export class TemplateUpdater {
    /** @type {DomainTemplateFinder} is initialized in the constructor */
    #templateFinder;
    /** @type {KnexTemplatesRepository} is initialized in the constructor */
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#templateFinder = new DomainTemplateFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }
    /**
     * Updates an Template object in the repository.
     *
     * @param {string} id - The unique identifier of the Template object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the Template object.
     * @returns {Promise<void>} A promise that resolves when the Template object is updated.
     */
    async execute(id, dto) {
        const template = await this.#templateFinder.execute(id);

        if (!template) {
            throw new Error(`Template with ID ${id} does not exist.`);
        }

        if (dto.descripcion) {
            await this.#uniquenessValidator.validate('descripcion', dto.descripcion, id);
        }

        const originalValues = template.toJson();
        template.update(dto);

        await this.#repository.update(template);
        await this.#repository.saveHistory(template, originalValues);
        template.flushChanges();
    }
}
