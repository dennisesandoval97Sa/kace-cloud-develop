import { Criteria } from '../../../shared/criteria/Criteria';
import { TransitionsCounter } from '../../index';
import { TransitionsCollectionResponse } from '../TransitionsCollectionResponse';

export class TransitionSearcher {
    /**
     * @type {KnexTransitionsRepository}
     * is initialized in the constructor
     */
    #repository;

    /** @type {TransitionsCounter} is initialized in the constructor */
    #counter;
    /**
     *
     * @param {KnexTransitionsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new TransitionsCounter(repository);
    }

    /**
     *
     * @param {object} dtoCriteria object with filter, relationship, limit, offset, order for search a transitions
     * @param {string} dtoCriteria.filter
     * @param {string} dtoCriteria.relationship
     * @param {number} dtoCriteria.limit
     * @param {number} dtoCriteria.offset
     * @param {string} dtoCriteria.order
     * @returns {Promise<TransitionsCollectionResponse[]>}
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
        const transitions = await this.#repository.search(criteria);
        const counter = await this.#counter.execute(dtoCriteria);

        return new TransitionsCollectionResponse(transitions, counter);
    }
}
