import { ValidateEntityExists } from '../../domain/ValidateEntityExists.js';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { KnexAuxiliariesRepository } from '../../infrastructure/persistence/KnexAuxiliariesRepository.js';
import { AuxiliaryResponse } from '../AuxiliaryResponse.js';

export class AuxiliaryFinder {
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
     * Busca un registro específico en una tabla auxiliar por su ID
     * @param {string} tableName - Nombre de la tabla donde se buscará el registro
     * @param {string|number} id - ID del registro a buscar
     * @returns {Promise<object|null>} El registro encontrado o null si no existe
     * @throws {ValidationFailError} Si la tabla no existe
     */
    async execute(id, tableName) {
        await this.#validateEntityExists.execute(tableName);

        if (!id) {
            throw new ValidationFailError('El ID no puede estar vacío', 'id');
        }

        const auxiliary = await this.#repository.find(new ValueObjectUuid('auxiliary_id', id), tableName);

        return new AuxiliaryResponse(auxiliary);
    }
}
