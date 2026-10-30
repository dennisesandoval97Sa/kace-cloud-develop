import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/domain/Counter.js';
import { WSRestFunctionCollectionResponse } from '../WSRestFunctionCollectionResponse.js';

export class WSRestFunctionSearcher {
    /**
     * @type {KnexWSRestFunctionRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {Counter} is initialized in the constructor
     */
    #counter;

    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Executes the search of RestFunction objects based on the criteria provided.
     *
     * @param {Object} criteria - The criteria to search for RestFunction objects.
     * @returns {Promise<WSRestFunctionCollectionResponse>} A promise that resolves with the collection of RestFunction objects found.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const criteria = new Criteria(filter, relationship, limit, offset, order);

        const RestFunction = await this.#repository.search(criteria);
        const RestFunctionCount = await this.#counter.execute({
            filter,
            relationship,
            limit,
            offset,
            order,
        });

        return new WSRestFunctionCollectionResponse(RestFunction, RestFunctionCount);
    }
}
