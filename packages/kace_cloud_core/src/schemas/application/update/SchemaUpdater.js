import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { SchemaFinder } from '../../domain/SchemaFinder.js';
import { RestFlowExistenceValidator } from '../../../shared/validation/RestFlowExistenceValidator.js';
import { CalculateTypeValidator } from '../../domain/validator-types/CalculateTypeValidator.js';
import { DataStructureLabelService } from '../../domain/DataStructureLabelService.js';

export class SchemaUpdater {
    /** @type {SchemaFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexSchemasRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.#finder = new SchemaFinder(repository);
        this.#repository = repository;
    }

    /**
     * Actualiza un Schema existente.
     * @param {object} dto - Datos para actualizar
     * @param {string} id - Identificador del registro a actualizar
     * @returns {Promise<void>}
     */
    async execute(dto, id) {
        const schema = await this.#finder.execute(id);
        if (!schema) {
            throw new ValidationFailError(`Schema with id ${id} does not exist`);
        }

        const data_structure = dto.data_structure;

        if (data_structure) {
            for (const [fieldName, config] of Object.entries(data_structure)) {
                if (config.type === 'calculated') {
                    new CalculateTypeValidator().validate(fieldName, config, data_structure);
                }
            }

            DataStructureLabelService.assignDefaultLabels(data_structure);

            const restflowValidator = new RestFlowExistenceValidator(this.#repository);
            for (const key in data_structure) {
                if (data_structure[key].hasOwnProperty('restflow_id') && data_structure[key].restflow_id) {
                    await restflowValidator.execute(
                        new ValueObjectUuid('restFlow_id', data_structure[key].restflow_id)
                    );
                }
            }
        }

        const originalValues = schema.toJson();
        schema.update(dto);
        await this.#repository.update(schema);
        await this.#repository.saveHistory(schema, originalValues);
        schema.flushChanges();
    }
}
