import { Criteria } from '../../../shared/criteria/Criteria';
import { CaseCounter } from '../../domain/CaseCounter';
import { KnexCaseRepository } from '../../infrastructure/persistence/KnexCaseRepository';
import { CaseDataGridResponse } from '../CaseDataGridResponse';
import { clampPageSize } from './clampPageSize.js';

export class CaseSearcher {
    /**
     * @type {KnexCaseRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     *
     * @param {KnexCaseRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {object} dtoCriteria data object to search case
     * @returns
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const limit = clampPageSize(dtoCriteria.limit);
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );
        const countCriteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, null, 0, null, tablename);

        const searcher = await this.#repository.search(criteria);
        const counter = await this.#repository.searchCount(countCriteria);
        const countByStatus = await this.#repository.searchCountByStatus(countCriteria);

        return new CaseDataGridResponse(searcher, counter.count, countByStatus);
    }
}
