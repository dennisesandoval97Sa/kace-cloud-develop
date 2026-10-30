import { ValueObjectUuid } from '../../shared/index.js';

export class FakeClientFinder {
    /** @type {KnexFakeClientRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id
     * @return {Promise<import ('./FakeClient.js').FakeClient>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
