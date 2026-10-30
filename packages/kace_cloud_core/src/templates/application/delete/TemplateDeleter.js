import { DomainTemplateFinder } from '../../index.js';

export class TemplateDeleter {
    /** @type {DomainTemplateFinder} is initialized in the constructor*/
    #templateFinder;
    /** @type {KnexTemplatesRepository} is initialized in the constructor*/
    #repository;

    constructor(repository) {
        this.#repository = repository;
        this.#templateFinder = new DomainTemplateFinder(repository);
    }

    /**
     * Deletes an Template object from the repository.
     *
     * @param {string} id - The unique identifier of the Template object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the Template object.
     * @returns {Promise<void>} A promise that resolves when the Template object is deleted.
     */
    async execute(id, dto) {
        const template = await this.#templateFinder.execute(id);

        const originalValues = template.toJson();
        template.delete(dto);

        await this.#repository.delete(template);
        await this.#repository.saveHistory(template, originalValues);

        template.flushChanges();
    }
}
