import { ValueObjectUuid } from '../../shared';

export class PoliciesFinder {
    /**
     *  @type {KnexPoliciesRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     *
     * @param {KnexPoliciesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id identificador for value to find
     * @returns {Promise<Policy>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
