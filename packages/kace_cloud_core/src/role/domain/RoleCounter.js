import { Criteria } from '../../shared/criteria/Criteria';

export class RoleCounter {
    /** @type {KnexRoleRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexRoleRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {object} dtoCriteria criteria for searching
     * @returns {Promise<number>}
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationships, 0, 0, undefined, tablename);
        return this.#repository.count(criteria);
    }
}
