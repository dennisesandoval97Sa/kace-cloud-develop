import { KnexSchemasRepository } from '../../infrastructure/persistence/KnexSchemasRepository.js';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { SchemaResponse } from '../SchemaResponse.js';

export class SchemaRules {
    /** @type {KnexSchemasRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Obtiene el detalle de relaciones anidadas de un schema por su id.
     * @param {string} id
     * @returns {Promise<SchemaResponse|object>}
     */
    async execute(id) {
        const schemaId = new ValueObjectUuid('schema_id', id);
        const exists = await this.#repository.find({ value: schemaId.value });
        if (!exists) {
            throw new ValidationFailError(`El schema con id ${id} no existe`, id);
        }
        const schema = await this.#repository.getSchemaRules({ value: schemaId.value });
        return new SchemaResponse(schema);
    }
}
