import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid.js';

export class WSRestFunctionFinder {
    /** @type {KnexWSRestFunctionRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Find an WSRestFunction by its id
     *
     * @param {string} id
     * @return {Promise<WSRestFunction>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
