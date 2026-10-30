import { ValueObjectUuid } from '../../shared/index.js';

export class AnsFinder {
    /** @type {Object} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {string} id
     * @return {Promise<Ans>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
