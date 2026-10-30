import { ValueObjectUuid } from '../../shared/index.js';

export class ClientFinder {
    /** @type {KnexClientRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id
     * @return {Promise<import ('./Client.js').Client>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
