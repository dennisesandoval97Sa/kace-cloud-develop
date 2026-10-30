import { ValueObjectUuid } from '../../../shared/index.js';

export class AdapterFinder {
    /** @type {Object} repository */
    #repository;

    /**
     * @param {Object} repository - repository implementing findById
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Find an adapter settings by id
     * @param {string} id
     */
    async execute(id) {
        const validId = new ValueObjectUuid('id', id).value;
        return this.#repository.findById(validId);
    }
}
