import { SchemaCollectionResponse } from '../SchemaCollectionResponse.js';
import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/index.js';

export class SchemaSearcher {
    /** @type {KnexSchemasRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;
    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Busca Schemas según los criterios dados y retorna una colección estándar.
     * @param {Object} dtoCriteria - Criterios de búsqueda (filter, relationship, limit, offset, order)
     * @returns {Promise<SchemaCollectionResponse>}
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
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute(dtoCriteria);
        const countResult = count.count || count['count(*)'];
        return new SchemaCollectionResponse(rows, countResult);
    }
}
