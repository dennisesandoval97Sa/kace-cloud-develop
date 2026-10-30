import { Criteria } from '../../shared/criteria/Criteria';
import { Counter } from '../../shared/domain/Counter';
import { StateSelectCollectionResponse } from './StateSelectCollectionResponse';

export class StateSelectSearcher {
    #repository;
    #counter;

    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    async execute() {
        const defaults = {
            filter: undefined,
            relationship: undefined,
            limit: 0,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const tablename = this.#repository.tableName;

        const criteria = new Criteria(
            defaults.filter,
            defaults.relationship,
            defaults.limit,
            defaults.offset,
            defaults.order,
            tablename
        );

        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({
            filter: defaults.filter,
            relationship: defaults.relationship,
        });

        return new StateSelectCollectionResponse(rows, count);
    }
}
