import { Criteria, ValueObjectUuid } from '../../../shared';
import { EventCollectionResponse } from '../EventCollectionResponse';
import { Counter } from '../../../shared';

export class EventSearcherByCaseId {
    /** @type {KnexEventRepository} is initialized in the constructor */
    #repository;
    /**
     * @type {Counter} is initialized in the constructor
     */
    #counter;

    /**
     * Creates an instance of the `EventFinder`.
     *
     * @param {KnexEventRepository} repository - An instance of the repository that manages event records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Executes the process of finding Events to match with Case ID.
     *
     * @param {string} case_id - The unique identifier of the Case object to find.
     * @param {Object} dtoCriteria - The DTO containing filter, relationship, pagination, and sorting options.
     * @returns {Promise<EventResponse>} A promise that resolves with a paginated and filtered list of events.
     */
    async execute(case_id, dtoCriteria) {
        const tableName = this.#repository.tableName;

        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tableName
        );

        const baseFilter = Array.isArray(dtoCriteria.filter) ? [...dtoCriteria.filter] : [];
        baseFilter.push({
            field: 'case_id',
            operator: 'eq',
            type: 'AND',
            value: case_id,
        });

        const eventsCount = await this.#counter.execute({
            filter: baseFilter,
            relationship: dtoCriteria.relationship,
        });
        const countResult = eventsCount.count || eventsCount['count(*)'];
        const rows = await this.#repository.getEventsByCaseId(new ValueObjectUuid('case_id', case_id), criteria);
        return new EventCollectionResponse(rows, countResult);
    }
}
