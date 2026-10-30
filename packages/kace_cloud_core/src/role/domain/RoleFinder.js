import { ValueObjectUuid } from '../../shared';

export class RoleFinder {
    /** @type {KnexRoleRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexRoleRepository} #repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id id for find
     * @returns
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
