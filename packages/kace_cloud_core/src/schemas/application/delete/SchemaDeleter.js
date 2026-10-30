import { ValidationFailError } from '../../../shared/index.js';
import { SchemaFinder } from '../../domain/SchemaFinder.js';

export class SchemaDeleter {
    /** @type {SchemaFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexSchemasRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new SchemaFinder(repository);
    }

    /**
     * Elimina (soft delete) un Schema actualizando deleted_at y deleted_by.
     * @param {string|object} id - Identificador de la entidad
     * @param {Object} dto - Debe contener deleted_at y deleted_by
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const schema = await this.#finder.execute(id);
        if (!schema) {
            throw new ValidationFailError(`Schema with id ${id} does not exist`);
        }
        if (!dto || !dto.deleted_at) {
            throw new ValidationFailError('The deleted_at field is required to delete.');
        }
        if (!dto || !dto.deleted_by) {
            throw new ValidationFailError('The deleted_by field is required to delete.');
        }
        const originalValues = schema.toJson();
        schema.delete(dto);
        await this.#repository.update(schema);
        await this.#repository.saveHistory(schema, originalValues);
        schema.flushChanges();
    }
}
