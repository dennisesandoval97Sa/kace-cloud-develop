import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { Schema } from '../../domain/Schema.js';
import { SchemaFinder } from '../../domain/SchemaFinder.js';
import { RestFlowExistenceValidator } from '../../../shared/validation/RestFlowExistenceValidator.js';
import { DataStructureLabelService } from '../../domain/DataStructureLabelService.js';
import { CalculateTypeValidator } from '../../domain/validator-types/CalculateTypeValidator.js';
export class SchemaCreator {
    /** @type {KnexSchemasRepository} is initialized in the constructor */
    #repository;
    /** @type {SchemaFinder} is initialized in the constructor */
    #finder;

    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new SchemaFinder(repository);
    }

    /**
     * Crea un nuevo Schema y lo guarda en el repositorio.
     * @param {Object} dto - Datos para la creación de la entidad.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        const schema = Schema.create(dto);
        const exists = await this.#finder.execute(schema.id.value);
        if (exists) {
            throw new ValidationFailError(`Schema with id ${schema.id.value} already exists`);
        }

        const data_structure = schema.data_structure.value;

        for (const [fieldName, config] of Object.entries(data_structure)) {
            if (config.type === 'calculated') {
                new CalculateTypeValidator().validate(fieldName, config, data_structure);
            }
        }

        DataStructureLabelService.assignDefaultLabels(data_structure);

        const restflowValidator = new RestFlowExistenceValidator(this.#repository);
        for (const key in data_structure) {
            if (data_structure[key].hasOwnProperty('restflow_id') && data_structure[key].restflow_id) {
                await restflowValidator.execute(new ValueObjectUuid('restFlow_id', data_structure[key].restflow_id));
            }
        }

        await this.#repository.save(schema);
        await this.#repository.saveHistory(schema);
    }
}
