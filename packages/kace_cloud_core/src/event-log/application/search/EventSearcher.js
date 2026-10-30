import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/domain/Counter.js';
import { EventCollectionResponse } from '../EventCollectionResponse.js';

export class EventSearcher {
    /** @type {KnexEventRepository} */
    #repository;

    /** @type {Counter} */
    #counter;

    /**
     * Creates an instance of `EventSearcher`.
     *
     * @param {KnexEventRepository} repository - The repository used to search and count Event records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Executes the search operation based on dynamic filtering criteria.
     *
     * @param {Object} dtoCriteria - The DTO containing filter, relationship, pagination, and sorting options.
     * @returns {Promise<EventCollectionResponse>} A promise that resolves with a paginated and filtered list of events.
     */
    async execute(dtoCriteria) {
        const tableName = this.#repository.tableName;

        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tableName
        );

        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });

        return new EventCollectionResponse(rows, count);
    }
}
