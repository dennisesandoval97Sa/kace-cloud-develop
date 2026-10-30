import { Criteria } from '../../../shared/criteria/Criteria';
import { Counter } from '../../../shared/domain/Counter';
import { HelpsCollectionResponse } from '../HelpsCollectionResponse';

export class HelpsSearcher {
    /** @type {KnexHelpsRepository} is initialized in the constructor */
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
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });

        return new HelpsCollectionResponse(rows, count);
    }
}
