import { ValidationFailError } from '../../shared/index.js';

export class AuxSchemaExistenceValidator {
    /** @type {KnexSchemasRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Valida que el schema_id exista en la tabla aux_schemas.
     * @param {ValueObjectUuid} schema_id
     * @returns {Promise<void>} Lanza error si no existe
     */
    async execute(schema_id) {
        const exists = await this.#repository.find(schema_id);
        if (!exists) {
            throw new ValidationFailError(`The ${schema_id.value} does not exist in schemas`, 'id');
        }
    }
}
