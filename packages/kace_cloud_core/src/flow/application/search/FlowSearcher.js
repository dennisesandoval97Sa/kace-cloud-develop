import { Criteria } from '../../../shared/criteria/Criteria';
import { FlowCounter } from '../../domain/FlowCounter';
import { FlowCollectionResponse } from '../FlowCollectionResponse';

export class FlowSearcher {
    /** @type {KnexFlowRepository} is initialized in the constructor */
    #repository;

    /** @type {FlowCounter} is initialized in the constructor */
    #counter;

    /**
     *
     * @param {KnexFlowRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new FlowCounter(repository);
    }

    /**
     *
     * @param {object} dtoCriteria
     * @returns {Promise<FlowCollectionResponse[]>}
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
        const searcher = await this.#repository.search(criteria);
        const counter = await this.#counter.execute(dtoCriteria);

        return new FlowCollectionResponse(searcher, counter.count);
    }
}
