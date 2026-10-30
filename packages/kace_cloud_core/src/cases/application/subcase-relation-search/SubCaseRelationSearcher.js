import { Criteria } from '../../../shared';
import { Counter } from '../../../shared';
import { SubCaseRelationCollectionResponse } from '../SubCaseRelationCollectionResponse';
import { SubCaseRelationExtraSelectValidator } from './SubCaseRelationExtraSelectValidator.js';

export class SubCaseRelationSearcher {
    /** @type {KnexSubcaseRelationshipRepository} */
    #repository;
    /** @type {Counter} */
    #counter;

    /**
     * @param {KnexSubcaseRelationshipRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    async execute({ filter, relationship, limit, offset, order, select }) {
        SubCaseRelationExtraSelectValidator.validate(select, relationship);
        const tablename = 'cases';
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const rows = await this.#repository.search(criteria, select);
        const count = await this.#counter.execute({ filter, relationship });
        const countResult = count.count ?? count['count(*)'];
        return new SubCaseRelationCollectionResponse(rows, countResult);
    }
}
