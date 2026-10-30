import { ValueObjectUuid } from '../../shared/index.js';

export class GroupsFinder {
    /**
     * @type {KnexGroupsRepository}
     * is initialized in the constructor
     */
    #repository;
    /**
     *
     * @param {KnexGroupsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id id for find group
     * @returns {Promise<Groups|null>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    /**
     * Finds work queue groups and their corresponding capacity metrics.
     * @returns {Promise<Array<Object>>}
     */
    async findWorkQueueGroupsWithCapacity() {
        return this.#repository.findWorkQueueGroupsWithCapacity();
    }
}
