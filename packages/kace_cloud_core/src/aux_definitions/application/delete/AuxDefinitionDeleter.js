import { AuxDefinitionFinder } from '../../domain/AuxDefinitionFinder.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class AuxDefinitionDeleter {
    /** @type {AuxDefinitionFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexAuxDefinitionsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexAuxDefinitionsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new AuxDefinitionFinder(repository);
    }

    /**
     * Elimina (soft delete) un AuxDefinition actualizando deleted_at y deleted_by.
     * @param {string|object} id - Identificador de la entidad
     * @param {Object} dto - Debe contener deleted_at y deleted_by
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const auxDefinition = await this.#finder.execute(id);
        if (!auxDefinition) {
            throw new CustomError(`AuxDefinition con ID ${id} no existe.`, 404);
        }
        if (!dto || !dto.deleted_at) {
            throw new CustomError('El campo deleted_at es obligatorio para eliminar.', 400);
        }
        if (!dto || !dto.deleted_by) {
            throw new CustomError('El campo deleted_by es obligatorio para eliminar.', 400);
        }
        const originalValues = auxDefinition.toJson();
        auxDefinition.delete(dto);
        await this.#repository.update(auxDefinition);
        await this.#repository.saveHistory(auxDefinition, originalValues);
        auxDefinition.flushChanges();
    }
}
