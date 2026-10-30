import { Criteria } from '../../shared/criteria/Criteria';
import { BannersCountResponse } from '../application/BannersCountResponse';

export class BannerCounter {
    /**
     * @type {KnexBannersRepository}
     * is initialized in the constructor
     */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, null, tablename);
        const response = await this.#repository.count(criteria);

        return new BannersCountResponse(response);
    }
}
