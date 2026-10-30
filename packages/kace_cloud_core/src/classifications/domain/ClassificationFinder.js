import { ValueObjectUuid } from '../../shared/index.js';

export class ClassificationFinder {
    /** @type {KnexClassificationRepository} is initialized in the constructor*/
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id
     * @param {Object} options - Optional parameters
     * @param {boolean} options.skipCache - Whether to bypass the cache
     * @return {Promise<Classification>}
     */
    async execute(id, options = {}) {
        return this.#repository.find(new ValueObjectUuid('id', id), options);
    }
}
