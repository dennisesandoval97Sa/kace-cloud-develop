import { Criteria } from '../../../shared/criteria/Criteria';
import { CaseCounter } from '../../domain/CaseCounter';
import { CaseViewCollectionResponse } from '../CaseViewCollectionResponse';
import { clampPageSize } from './clampPageSize.js';

export class ViewCaseSearcher {
    /**
     * @type {KnexCaseRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {CaseCounter}
     * is initialized in the constructor
     */
    #counter;

    /**
     *
     * @param {KnexCaseRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new CaseCounter(repository);
    }

    /**
     *
     * @param {object} dtoCriteria data object to search case
     * @returns
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, clampPageSize(limit), offset, order, tablename);
        const countCriteria = new Criteria(filter, relationship, null, 0, null, tablename);

        const searcher = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({ filter, relationship });
        const countByStatus = await this.#repository.searchCountByStatus(countCriteria);

        return new CaseViewCollectionResponse(searcher, counter, countByStatus);
    }
}
