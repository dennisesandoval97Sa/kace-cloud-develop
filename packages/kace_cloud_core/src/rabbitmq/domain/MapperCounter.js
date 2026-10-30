import { Criteria } from '../../shared/criteria/Criteria.js';

export class MapperCounter {
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute({ filter, relationship }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, null, 0, null, tablename);

        const count = await this.#repository.count(criteria);

        return { count };
    }
}
