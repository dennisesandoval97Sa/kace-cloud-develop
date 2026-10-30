import { Criteria } from '../../../shared/criteria/Criteria';
import { PoliciesCounter as DomainPoliciesCounter } from '../../domain/PoliciesCounter';
import { PolicyCollectionResponse } from '../PolicyCollectionResponse';

export class PoliciesSearcher {
    /**
     * @type {KnexPoliciesRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainPoliciesCounter}
     * is initialized in the constructor
     */
    #counter;

    /**
     *
     * @param {KnexPoliciesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new DomainPoliciesCounter(repository);
    }

    /**
     *
     * @param {object} dtoCriteria data object criteria for search
     * @returns {Promise<PolicyCollectionResponse>}
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );
        const policies = await this.#repository.search(criteria);
        const count = await this.#counter.execute(criteria);

        return new PolicyCollectionResponse(policies, count);
    }
}
