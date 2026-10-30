import { Criteria } from '../../../shared/criteria/Criteria.js';
import { TransitionRuleCollectionResponse } from '../TransitionRuleCollectionResponse.js';
import { TransitionRuleCounter } from '../../domain/TransitionRuleCounter.js';

export class TransitionRuleSearcher {
    /** @type {KnexTransitionRuleRepository} */
    #repository;

    /** @type {TransitionRuleCounter} */
    #count;

    /**
     * @param {KnexTransitionRuleRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new TransitionRuleCounter(repository);
    }

    /**
     * @param {Object} dtoCriteria
     * @returns {Promise<TransitionRuleCollectionResponse>}
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#count.execute({ filter, relationship });

        return new TransitionRuleCollectionResponse(rows, counter);
    }
}
