import { ValueObjectUuid } from '../../shared/index.js';

export class ClassificationsValidator {
    /** @type {KnexClassificationsFlowsRepository} is initialized in the constructor*/
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id
     * @return {Boolean}
     */
    async execute(id) {
        if (typeof id === 'object' && Array.isArray(id)) {
            const ids = id.map((i) => new ValueObjectUuid('id', i));
            return await this.#repository.validateMultipleClassifications(ids);
        }
        return false;
    }
}
