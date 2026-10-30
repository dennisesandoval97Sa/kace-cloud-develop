import { ValueObjectUuid } from '../../shared';

export class FlowFinder {
    /** @type {KnexFlowRepository} is initialized in the constructor */
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
     * @param {string} id
     * @returns {Promise<Flow>}
     * @throws {Error}
     */

    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
