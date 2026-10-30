import { Criteria } from '../../../shared/criteria/Criteria';
import { CasesAllRelationsCollectionResponse } from '../CasesAllRelationsCollectionResponse';
import { clampPageSize } from './clampPageSize.js';

export class RelationsCaseSearcher {
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Ejecuta Criteria y devuelve la página enriquecida + total.
     * @param {{filter:any, relationship:any, limit?:number, offset?:number, order?:any}} dtoCriteria
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;

        const limit = clampPageSize(dtoCriteria?.limit);

        const criteria = new Criteria(
            dtoCriteria?.filter,
            dtoCriteria?.relationship,
            limit,
            dtoCriteria?.offset,
            dtoCriteria?.order,
            tablename
        );

        const data = await this.#repository.searchWithAllRelations(criteria);

        const counter = await this.#repository.searchCount(
            new Criteria(dtoCriteria?.filter, dtoCriteria?.relationship, null, 0, null, tablename)
        );

        return new CasesAllRelationsCollectionResponse(data, counter.count);
    }
}
