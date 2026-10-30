import { ValidateEntityExists } from '../../domain/ValidateEntityExists.js';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY } from '@kace/error-codes';
import { KnexAuxiliariesRepository } from '../../infrastructure/persistence/KnexAuxiliariesRepository.js';

export class AuxiliaryDeleter {
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
     * Elimina un registro existente en una tabla auxiliar
     * @param {string} id - ID del registro a eliminar
     * @param {Object} dto - DTO con deleted_at y deleted_by
     * @param {string} tableName - Nombre de la tabla donde se eliminará el registro
     * @returns {Promise<void>}
     * @throws {ValidationFailError} Si la tabla no existe, el registro no existe
     *   o tiene dependencia con una entidad principal
     */
    async execute(id, dto, tableName) {
        await this.#validateEntityExists.execute(tableName);

        if (!id) {
            throw new ValidationFailError('El ID no puede estar vacío', 'id');
        }

        const auxiliary = await this.#repository.find(new ValueObjectUuid('auxiliary_id', id), tableName);
        if (!auxiliary) {
            throw new ValidationFailError(`No existe un registro con el ID ${id}`, 'id');
        }

        const hasDependency = await this.#repository.hasMainEntityDependency(id, tableName);
        if (hasDependency) {
            throw new ValidationFailError(
                'No se puede eliminar el registro porque está vinculado a una entidad principal',
                'id',
                [],
                AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY
            );
        }

        const originalValues = auxiliary.toJson();
        auxiliary.delete(dto);
        await this.#repository.update(auxiliary, tableName);
        await this.#repository.saveHistory(auxiliary, originalValues, tableName);
        auxiliary.flushChanges();
    }
}
