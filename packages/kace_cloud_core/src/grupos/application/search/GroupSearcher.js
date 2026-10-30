import { AnsCasesCounter, Criteria } from '../../../shared/index.js';
import { GroupCounter } from '../../domain/GroupCounter';
import { GroupCollectionResponse } from '../GroupCollectionResponse';

export class GroupSearcher {
    /**
     * @type {KnexGroupsRepository}
     * is initialized in the constructor
     */
    #repository;
    /** @type {AnsCasesCounter} is initialized in the constructor */
    #serviceAnsCases;

    /** @type {GroupCounter} is initialized in the constructor */
    #counter;

    /**
     *
     * @param {KnexGroupsRepository} repository
     * @param {KnexCaseRepository} casesRepository
     */
    constructor(repository, casesRepository) {
        this.#repository = repository;
        this.#serviceAnsCases = new AnsCasesCounter(casesRepository);
        this.#counter = new GroupCounter(repository);
    }

    /**
     *
     * @param {object} dtoCriteria criteria for filter groups
     * @returns {Promise<GroupCollectionResponse>}
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationships,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );

        const result = await this.#repository.search(criteria);
        const counter = await this.#counter.execute(dtoCriteria);
        const groupsWithCasesCount = await this.#addCasesCounter(result);

        return new GroupCollectionResponse(groupsWithCasesCount, counter.count);
    }

    /**
     * Adds case counters to each group.
     *
     * @param {Array} groups - Array of group objects with an id property.
     * @returns {Promise<Array>} - Resolves to an array of groups with added
     */
    async #addCasesCounter(groups) {
        return Promise.all(
            groups.map(async (group) => {
                const { expired, intermediate, notExpired } = await this.#serviceAnsCases.execute(
                    'group',
                    group.id.value
                );
                group.notExpiredCasesCount = expired;
                group.intermediateCasesCount = intermediate;
                group.expiredCasesCount = notExpired;
                return group;
            })
        );
    }
}
