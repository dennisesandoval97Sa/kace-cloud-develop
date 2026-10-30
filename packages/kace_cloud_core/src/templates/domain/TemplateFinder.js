import { ValueObjectUuid } from '../../shared/index.js';

export class TemplateFinder {
    /** @type {KnexTemplatesRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id
     * @return {Promise<Template>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
