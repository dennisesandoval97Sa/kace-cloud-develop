import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { DomainTemplateFinder, Template } from '../../index';
import { CustomError } from '../../../shared/index.js';

export class TemplateCreator {
    #repository;
    /** @type {DomainTemplateFinder} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainTemplateFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the creation of an Template object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the Template object.
     * @returns {Promise<void>} A promise that resolves when the Template object is saved.
     */
    async execute(dto) {
        const template = Template.create(dto);

        const result = await this.#finder.execute(template.id.value);
        if (result) {
            throw new CustomError(`Template with id ${template.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('descripcion', dto.descripcion);

        await this.#repository.save(template);
        await this.#repository.saveHistory(template);
    }
}
