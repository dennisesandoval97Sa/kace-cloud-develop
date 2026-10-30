import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/domain/Counter.js';
import { ChannelHubAccountsCollectionResponse } from '../ChannelHubAccountsCollectionResponse.js';

export class ChannelHubAccountSearcher {
    #repository;
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

        return new ChannelHubAccountsCollectionResponse(rows, count);
    }
}
