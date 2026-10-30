import { Criteria } from '../../../shared/index.js';
import { MapperCollectionResponse } from '../MapperCollectionResponse.js';
import { MapperCounter } from '../../domain/MapperCounter.js';

export class MapperSearcher {
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
        this.#counter = counter ?? new MapperCounter(repository);
    }

    /**
     * Search mappers using provided filter
     * @param {Object} filter
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({ filter, relationship });

        return new MapperCollectionResponse(rows, counter.count);
    }
}
