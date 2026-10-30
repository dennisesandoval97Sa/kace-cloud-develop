import { DomainTemplateFinder, TemplateResponse } from '../../index.js';

export class TemplateFinder {
    /** @type {DomainTemplateFinder} is initialized in the constructor*/
    #finder;

    constructor(repository) {
        this.#finder = new DomainTemplateFinder(repository);
    }

    /**
     * Executes the finding of an Template object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Template object to find.
     * @returns {Promise<TemplateResponse>} A promise that resolves to an TemplateResponse object containing the found Template data.
     */
    async execute(id) {
        const template = await this.#finder.execute(id);
        return new TemplateResponse(template);
    }
}
