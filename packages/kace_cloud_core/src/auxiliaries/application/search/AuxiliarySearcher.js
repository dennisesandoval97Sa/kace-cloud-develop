import { ValidateEntityExists } from '../../domain/ValidateEntityExists.js';
import { KnexAuxiliariesRepository } from '../../infrastructure/persistence/KnexAuxiliariesRepository.js';
import { Criteria } from '../../../shared/index.js';
import { AuxiliaryCollectionResponse } from '../AuxiliaryCollectionResponse.js';

export class AuxiliarySearcher {
    /** @type {KnexAuxiliariesRepository} */
    #repository;
    /** @type {ValidateEntityExists} */
    #validateEntityExists;

    /**
     * @param {KnexAuxiliariesRepository} repository - Repositorio para operaciones de auxiliares
     */
    constructor(repository) {
        this.#repository = repository;
        this.#validateEntityExists = new ValidateEntityExists(repository);
    }

    /**
     * Busca AuxDefinitions según los criterios dados y retorna una colección estándar.
     * @param {Object} dtoCriteria - Criterios de búsqueda (filter, relationship, limit, offset, order)
     * @returns {Promise<AuxiliaryCollectionResponse>} Los registros encontrados y el total
     * @throws {ValidationFailError} Si la tabla no existe
     */
    async execute(dtoCriteria, tableName) {
        await this.#validateEntityExists.execute(tableName);

        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tableName
        );

        const rows = await this.#repository.search(criteria, tableName);
        const count = await this.#repository.count(criteria, tableName);
        const countResult = count.count || count['count(*)'];
        return new AuxiliaryCollectionResponse(rows, countResult);
    }
}
