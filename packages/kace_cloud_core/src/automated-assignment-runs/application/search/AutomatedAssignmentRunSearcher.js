import { Criteria } from '../../../shared/criteria/Criteria.js';
import { AutomatedAssignmentRunCollectionResponse } from '../AutomatedAssignmentRunCollectionResponse.js';

export class AutomatedAssignmentRunSearcher {
    /** @type {import('../../infrastructure/persistence/KnexAutomatedAssignmentRunsRepository.js').KnexAutomatedAssignmentRunsRepository} */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {Object} dtoCriteria - { filter, relationship, limit, offset, order }
     * @return {Promise<AutomatedAssignmentRunCollectionResponse>}
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const rows = await this.#repository.search(criteria);

        const countCriteria = new Criteria(filter, relationship, null, null, null, tablename);
        const counter = await this.#repository.count(countCriteria);

        return new AutomatedAssignmentRunCollectionResponse(rows, counter.count);
    }
}
