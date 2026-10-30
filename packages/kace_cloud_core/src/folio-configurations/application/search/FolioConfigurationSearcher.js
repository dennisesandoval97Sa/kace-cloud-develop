import { Criteria } from '../../../shared/criteria/Criteria.js';
import { FolioConfigurationCollectionResponse } from '../FolioConfigurationCollectionResponse.js';
import { FolioConfigurationCounter } from '../../domain/FolioConfigurationCounter.js';

export class FolioConfigurationSearcher {
    /** @type {KnexFolioConfigurationRepository} */
    #repository;

    /** @type {FolioConfigurationCounter} */
    #count;

    /**
     * @param {KnexFolioConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new FolioConfigurationCounter(repository);
    }

    /**
     * @param {Object} dtoCriteria
     * @returns {Promise<FolioConfigurationCollectionResponse>}
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#count.execute({ filter, relationship });

        return new FolioConfigurationCollectionResponse(rows, counter);
    }
}
