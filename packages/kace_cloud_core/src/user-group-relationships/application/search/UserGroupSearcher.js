import { Criteria } from '../../../shared/criteria/Criteria';
import { UserGroupCollectionResponse } from '../UserGroupCollectionResponse';
import { Counter } from '../../../shared/domain/Counter';

const RELATION_TABLE = 'rel_usuarios_grupos';
const LEGACY_SOFT_DELETE_FIELDS = new Set(['deleted_at', `${RELATION_TABLE}.deleted_at`]);
const LEGACY_CREATED_AT_FIELDS = new Set(['created_at', `${RELATION_TABLE}.created_at`]);

const fieldName = (field) => String(field ?? '').trim();

const isLegacySoftDeleteFilter = (filter) =>
    LEGACY_SOFT_DELETE_FIELDS.has(fieldName(filter?.field)) && filter?.operator === 'null';

const normalizeFilters = (filters) => {
    if (!Array.isArray(filters)) return filters;

    return filters
        .map((filter) => {
            if (filter?.groupType && Array.isArray(filter.filters)) {
                const nestedFilters = normalizeFilters(filter.filters);
                return nestedFilters.length ? { ...filter, filters: nestedFilters } : null;
            }

            return isLegacySoftDeleteFilter(filter) ? null : filter;
        })
        .filter(Boolean);
};

const normalizeOrder = (order) => {
    if (!order) return order;

    if (Array.isArray(order)) {
        const normalizedOrders = order.filter((item) => !LEGACY_CREATED_AT_FIELDS.has(fieldName(item?.field)));
        return normalizedOrders.length ? normalizedOrders : null;
    }

    return LEGACY_CREATED_AT_FIELDS.has(fieldName(order.field)) ? null : order;
};

export class UserGroupSearcher {
    /** @type {KnexUserGroupRelationshipRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `UserGroupSearcher` class.
     *
     * @param {KnexUserGroupRelationshipRepository} repository - An instance of the repository that manages user group relationships records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Searches for user group relationships based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching user group relationships. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<UserGroupCollectionResponse>} A promise that resolves to an instance of `UserGroupCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const normalizedFilter = normalizeFilters(filter);
        const normalizedOrder = normalizeOrder(order);
        const criteria = new Criteria(normalizedFilter, relationship, limit, offset, normalizedOrder, tablename);
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({
            filter: normalizedFilter,
            relationship,
        });
        return new UserGroupCollectionResponse(rows, count);
    }
}
