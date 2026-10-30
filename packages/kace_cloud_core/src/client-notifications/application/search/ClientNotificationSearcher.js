import { Criteria } from '../../../shared/criteria/Criteria';
import { Counter } from '../../../shared/domain/Counter';
import { ClientNotificationCollectionResponse } from '../ClientNotificationCollectionResponse';

export class ClientNotificationSearcher {
    /** @type {KnexClientNotificationRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `ClientNotificationSearcher` class.
     *
     * @param {KnexClientNotificationRepository} repository - An instance of the repository that manages client notification records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Searches for client notifications based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching client notifications. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<ClientNotificationCollectionResponse>} A promise that resolves to an instance of `ClientNotificationCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({ filter, relationship });

        return new ClientNotificationCollectionResponse(rows, count);
    }
}
