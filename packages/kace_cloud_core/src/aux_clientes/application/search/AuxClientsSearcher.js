import { Criteria, Counter } from '../../../shared/index.js';
import { AuxClientsCollectionResponse } from '../AuxClientsCollectionResponse.js';

export class AuxClientsSearcher {
    /** @type {Repository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;

    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
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

        const count = await this.#counter.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });
        const countResult = count.count || count['count(*)'];

        const rows = await this.#repository.search(criteria);

        return new AuxClientsCollectionResponse(rows, countResult);
    }
}
