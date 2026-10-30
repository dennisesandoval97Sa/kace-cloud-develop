import { Criteria } from '../../../shared/index.js';
import { AdapterCollectionResponse } from '../AdapterCollectionResponse.js';
import { AdapterCounter } from '../../domain/AdapterCounter.js';

export class AdapterSearcher {
    /** @type {Object} repository */
    #repository;
    /** @type {Object} counter */
    #counter;

    /**
     * @param {Object} repository - repository implementing search
     * @param {Object} [counter] - optional counter service implementing execute({ filter, relationship })
     */
    constructor(repository, counter) {
        this.#repository = repository;
        this.#counter = counter ?? new AdapterCounter(repository);
    }

    /**
     * Search adapters using provided filter
     * @param {Object} filter
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({ filter, relationship });

        return new AdapterCollectionResponse(rows, counter.count);
    }
}
