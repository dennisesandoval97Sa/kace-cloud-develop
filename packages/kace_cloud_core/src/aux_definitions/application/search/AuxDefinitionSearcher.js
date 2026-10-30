import { AuxDefinitionCollectionResponse } from '../AuxDefinitionCollectionResponse.js';
import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/index.js';

export class AuxDefinitionSearcher {
    /** @type {KnexAuxDefinitionsRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;
    /**
     * @param {KnexAuxDefinitionsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Busca AuxDefinitions según los criterios dados y retorna una colección estándar.
     * @param {Object} dtoCriteria - Criterios de búsqueda (filter, relationship, limit, offset, order)
     * @returns {Promise<AuxDefinitionCollectionResponse>}
     */
    async execute(dtoCriteria) {
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            this.#repository.tableName
        );
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute(dtoCriteria);
        const countResult = count.count || count['count(*)'];
        return new AuxDefinitionCollectionResponse(rows, countResult);
    }
}
