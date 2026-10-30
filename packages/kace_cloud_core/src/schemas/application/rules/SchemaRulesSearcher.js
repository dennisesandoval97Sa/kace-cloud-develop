import { SchemaCollectionResponse } from '../SchemaCollectionResponse.js';
import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/index.js';

export class SchemaRulesSearcher {
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
        const resolved = [];
        for (const row of rows) {
            const rules = await this.#repository.getSchemaRules({ value: row.id.value });
            if (rules) {
                resolved.push(rules);
            }
        }
        const count = await this.#counter.execute(dtoCriteria);
        const countResult = count.count || count['count(*)'];
        return new SchemaCollectionResponse(resolved, countResult);
    }
}
