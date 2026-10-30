import { ValidateEntityExists } from '../../domain/ValidateEntityExists.js';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { KnexAuxiliariesRepository } from '../../infrastructure/persistence/KnexAuxiliariesRepository.js';

export class AuxiliaryBulkDeleter {
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
     * Elimina múltiples registros existentes en una tabla auxiliar
     * @param {string[]} ids - Array de IDs de registros a eliminar
     * @param {Object} dto - DTO con datos de eliminación (deleted_at, deleted_by)
     * @param {string} tableName - Nombre de la tabla donde se eliminarán los registros
     * @returns {Promise<{deleted: string[], skipped: string[], blocked: string[]}>} IDs eliminados, omitidos (ya eliminados) y bloqueados (con dependencia)
     * @throws {ValidationFailError} Si la tabla no existe o algún ID es inválido
     */
    async execute(ids, dto, tableName) {
        await this.#validateEntityExists.execute(tableName);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new ValidationFailError('El array de IDs no puede estar vacío', 'ids');
        }

        const validIds = [];
        const validEntities = [];
        const skippedIds = [];
        const blockedIds = [];

        for (const id of ids) {
            if (!id) {
                throw new ValidationFailError('El ID no puede estar vacío', 'id');
            }

            const auxiliary = await this.#repository.find(new ValueObjectUuid('auxiliary_id', id), tableName);

            if (!auxiliary) {
                skippedIds.push(id);
            } else {
                const hasDependency = await this.#repository.hasMainEntityDependency(id, tableName);
                if (hasDependency) {
                    blockedIds.push(id);
                } else {
                    validIds.push(id);
                    validEntities.push({ auxiliary, originalValues: auxiliary.toJson() });
                }
            }
        }

        if (validIds.length > 0) {
            await this.#repository.bulkDelete(validIds, dto, tableName);
            for (const { auxiliary, originalValues } of validEntities) {
                auxiliary.delete(dto);
                await this.#repository.saveHistory(auxiliary, originalValues, tableName);
                auxiliary.flushChanges();
            }
        }

        return { deleted: validIds, skipped: skippedIds, blocked: blockedIds };
    }
}
