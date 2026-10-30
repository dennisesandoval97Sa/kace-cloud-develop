import { ValueObjectUuid } from '../../shared/index.js';

export default class Finder {
    /**
     * @type {KnexFakeCaseRepository}
     */
    #repository; // is initialized in the constructor

    /**
     *
     * @param {KnexFakeCaseRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {ValueObjectUuid} id
     */
    execute(id) {
        return this.#repository.find(id);
    }
}
