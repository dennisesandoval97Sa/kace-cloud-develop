import { ValueObjectUuid } from '../../shared';

export class HelpsFinder {
    /** @type {KnexHelpsRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexHelpsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id id to find group
     * @returns
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
