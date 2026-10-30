import { Criteria } from '../../shared/criteria/Criteria.js';

export class UserGroupCounter {
    /** @type {KnexUserGroupRelationshipRepository} is initialized in the constructor */
    #repository;

    /**
     * Constructs a new instance of UserGroupCounter.
     * @param {KnexUserGroupRelationshipRepository} repository - The repository used to count user group relationships.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the operation to count the number of user group relationships based on the given criteria.
     * @param {Object} dtoCriteria - The data transfer object containing the criteria for the count operation.
     * - `filter`: An object specifying the filter conditions.
     * - `relationship`: An object specifying relationships to include in the search results.
     * @returns {Promise<number>} A promise that resolves to the count of user group relationships matching the criteria.
     */
    async execute({ filter, relationship }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, null, 0, null, tablename);

        return this.#repository.count(criteria);
    }
}
