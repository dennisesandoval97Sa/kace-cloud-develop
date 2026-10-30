import { ValueObjectUuid } from '../../shared/index.js';

export class EventFinder {
    /** @type {KnexEventRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {string} id
     * @returns {Promise<Event|null>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
