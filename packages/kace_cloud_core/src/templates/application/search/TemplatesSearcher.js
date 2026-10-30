import { Criteria } from '../../../shared/criteria/Criteria.js';
import { TemplatesCollectionResponse } from '../TemplatesCollectionResponse.js';
import { Counter } from '../../../shared/domain/Counter.js';

export class TemplatesSearcher {
    /** @type {KnexTemplatesRepository} is initialized in the constructor*/
    #repository;
    /** @type {Number} is initialized in the constructor*/
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
        return new TemplatesCollectionResponse(rows, counter);
    }
}
