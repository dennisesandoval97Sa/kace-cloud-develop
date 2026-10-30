import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/domain/Counter';
import { BannersSearchCollectionResponse } from '../BannersSearchCollectionResponse.js';

export class BannersSearcher {
    /** @type {KnexBannersRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #count;

    constructor(repository) {
        this.#repository = repository;
        this.#count = new Counter(this.#repository);
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
        const counter = await this.#count.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });

        return new BannersSearchCollectionResponse(rows, counter);
    }
}
