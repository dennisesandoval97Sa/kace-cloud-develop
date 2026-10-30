import { Criteria } from '../../../shared/criteria/Criteria.js';
import { AnsCollectionResponse } from '../AnsCollectionResponse.js';
import { AnsCounter } from '../../domain/AnsCounter.js';

export class AnsSearcher {
    /** @type {Repository} is initialized in the constructor */
    #repository;
    /** @type {AnsCounter} is initialized in the constructor */
    #counter;
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new AnsCounter(repository);
    }

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
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });

        return new AnsCollectionResponse(rows, count);
    }
}
