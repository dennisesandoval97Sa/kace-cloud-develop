import { Criteria } from '../../../shared/criteria/Criteria';
import { RoleCounter } from '../../domain/RoleCounter';
import { RoleCollectionResponse } from '../RoleCollectionResponse';

export class RoleSearcher {
    /** @type {KnexRoleRepository} is initialized in the constructor */
    #repository;

    /** @type {RoleCounter} is initialized in the constructor */
    #counter;
    /**
     *
     * @param {KnexRoleRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new RoleCounter(repository);
    }

    /**
     *
     * @param {object} dtoCriteria criteria for search
     * @returns
     */

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
        const result = await this.#repository.search(criteria);
        const counter = await this.#counter.execute(dtoCriteria);

        return new RoleCollectionResponse(result, counter.count);
    }
}
