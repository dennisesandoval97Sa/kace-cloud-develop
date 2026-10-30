import { Criteria } from '../../../shared/criteria/Criteria';
import { StateCounter } from '../../domain/StateCounter';
import { StateCollectionResponse } from '../StateCollectionResponse';

export class StateSearcher {
    /** @type {KnexStateRepository} is initialized in the constructor */
    #repository;

    /** @type {StateCounter} is initialized in the constructor */
    #count;
    constructor(repository) {
        this.#repository = repository;
        this.#count = new StateCounter(this.#repository);
    }

    /**
     * execute the searcher for state based on the given criteria
     *
     * @param {Object} dtoCriteria - criteria for search
     * @returns {Promise<State[]>} - data return when promise is resolved
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

        const states = await this.#repository.search(criteria);
        const counter = await this.#count.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });
        return new StateCollectionResponse(states, counter.count);
    }
}
