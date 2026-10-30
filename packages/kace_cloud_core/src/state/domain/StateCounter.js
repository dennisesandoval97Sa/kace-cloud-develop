import { Criteria } from '../../shared/criteria/Criteria';

export class StateCounter {
    /** @type {KnexStateRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }

    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);

        return this.#repository.count(criteria);
    }
}
