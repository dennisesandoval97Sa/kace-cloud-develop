import { VOTableName } from '../../domain/VOTableName.js';
import { SchemaRules } from '../../../schemas/application/rules/SchemaRules.js';

export class AuxDefinitionDataStructureFinder {
    /** @type {KnexAuxDefinitionsRepository} is initialized in the constructor */
    #auxDefinitionsRepository;
    /** @type {SchemaRules} is initialized in the constructor */
    #schemaRules;

    /**
     * @param {KnexAuxDefinitionsRepository} auxDefinitionsRepository
     * @param {KnexSchemasRepository} schemasRepository
     */
    constructor(auxDefinitionsRepository, schemasRepository) {
        this.#auxDefinitionsRepository = auxDefinitionsRepository;
        this.#schemaRules = new SchemaRules(schemasRepository);
    }

    /**
     * An aux table without definition has no schema, so no field rules: `{}`.
     * A definition pointing to a missing schema throws, as in the cases controllers.
     *
     * @param {string} tableName
     * @returns {Promise<Object>} the data_structure bound to the aux table.
     * @throws {ValidationFailError} when the definition's schema does not exist.
     */
    async execute(tableName) {
        const auxDefinition = await this.#auxDefinitionsRepository.findByTableName(new VOTableName(tableName));
        if (!auxDefinition?.schema_id?.value) return {};

        const schema = await this.#schemaRules.execute(auxDefinition.schema_id.value);
        return schema.toJson().data?.data_structure ?? {};
    }
}
