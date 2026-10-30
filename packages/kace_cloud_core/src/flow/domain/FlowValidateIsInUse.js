import { ValueObjectUuid } from '../../shared';

export class FlowValidateIsInUse {
    /**
     * @type {KnexFlowRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     *
     * @param {KnexFlowRepository} repository
     */

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id id for search
     * @returns {Promise<boolean}
     */
    async execute(id) {
        return this.#repository.validateFlowIsInUse(new ValueObjectUuid('id', id));
    }
}
