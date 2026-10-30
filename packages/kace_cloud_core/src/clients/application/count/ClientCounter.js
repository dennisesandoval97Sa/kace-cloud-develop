import { Criteria } from '../../../shared/criteria/Criteria';

export class ClientCounter {
    /** @type {KnexClientRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }

    execute({ select, condition, limit, offset, distinct }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(select, condition, limit, offset, distinct, tablename);
        return this.#repository.count(criteria);
    }
}
