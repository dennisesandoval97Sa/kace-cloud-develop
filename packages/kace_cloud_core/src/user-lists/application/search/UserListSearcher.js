import { Criteria } from '../../../shared/criteria/Criteria';
import { UserListCounter } from '../../domain/UserListCounter';
import { UserListCollectionResponse } from '../UserListCollectionResponse';

export class UserListSearcher {
    /** @type {KnexUserListsRepository} is initialized in the constructor */
    #repository;
    /** @type {UserListCounter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `UserListSearcher` class.
     *
     * @param {KnexUserListsRepository} repository - An instance of the repository that manages userList records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new UserListCounter(repository);
    }

    /**
     * Searches for userLists based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching userLists. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<UserListCollectionResponse>} A promise that resolves to an instance of `UserListCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({
            filter,
            relationship,
        });
        return new UserListCollectionResponse(rows, count);
    }
}
