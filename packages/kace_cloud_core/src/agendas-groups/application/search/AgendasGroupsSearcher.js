import { Criteria } from '../../../shared';
import { Counter } from '../../../shared/domain/Counter';
import { AgendasGroupsCollectionResponse } from '../AgendasGroupsCollectionResponse';

export class AgendasGroupsSearcher {
    /**
     * @type {KnexAgendasGroupsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {Counter} is initialized in the constructor
     */
    #counter;

    /**
     * @param {KnexAgendasGroupsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Search for relationships between agendas and groups.
     *
     * @param {Object} dto - The data transfer object.
     * @param {Array<object>} dto.filter - The filter criteria.
     * @param {Array<object>} dto.relationship - The relationship criteria.
     * @param {number} dto.limit - The maximum number of records to return.
     * @param {number} dto.offset - The number of records to skip.
     * @param {string} dto.order - The order criteria.
     *
     * @returns {Promise<AgendasGroupsCollectionResponse>} - Promise that resolves with the relationships found
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const agendasGroups = await this.#repository.search(criteria);
        const agendasGroupsCount = await this.#counter.execute({
            filter,
            relationship,
            limit,
            offset,
            order,
        });

        return new AgendasGroupsCollectionResponse(agendasGroups, agendasGroupsCount);
    }
}
