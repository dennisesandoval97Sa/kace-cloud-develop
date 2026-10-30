import { Criteria } from '../../../shared/criteria/Criteria.js';
import { CaseCounter } from '../../domain/CaseCounter.js';
import { KnexCaseRepository } from '../../infrastructure/persistence/KnexCaseRepository.js';
import { CaseDataGridResponse } from '../CaseDataGridResponse.js';
import { clampPageSize } from './clampPageSize.js';

export class VisibleCaseSearcher {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #count;

    constructor(repository) {
        this.#repository = repository;
        this.#count = new CaseCounter(this.#repository);
    }

    async execute(dtoCriteria, is_visible) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            clampPageSize(dtoCriteria.limit),
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );

        const updated = await this.#repository.updateByCriteria(criteria, {
            is_visible,
        });

        const counter = await this.#repository.searchCount(
            new Criteria(dtoCriteria.filter, dtoCriteria.relationship, null, 0, null, tablename)
        );

        return new CaseDataGridResponse(updated, counter.count);
    }
}
