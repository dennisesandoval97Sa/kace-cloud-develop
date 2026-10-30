import { Criteria } from '../../shared/criteria/Criteria.js';

export class UserListCounter {
    /** @type {KnexUserListsRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `UserListCounter` class.
     *
     * @param {KnexUserListsRepository} repository - An instance of the repository that manages userList records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Counts the number of userList in the repository that match the given criteria.
     *
     * This method creates a `Criteria` object from the provided DTO, then uses the repository to count the matching userList records.
     *
     * @param {Object} dtoCriteria - The criteria for searching userList. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @returns {Promise<number>} A promise that resolves to the count of userList records that match the given criteria.
     */
    async execute({ filter, relationship }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, null, null, null, tablename);
        return this.#repository.count(criteria);
    }
}
