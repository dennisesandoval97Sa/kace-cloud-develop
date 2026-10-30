import { AuxDefinition } from '../../domain/AuxDefinition.js';
import { AuxDefinitionFinder } from '../../domain/AuxDefinitionFinder.js';
import { AuxSchemaExistenceValidator } from '../../domain/AuxSchemaExistenceValidator.js';
import { RestFlowExistenceValidator } from '../../domain/RestFlowExistenceValidator.js';
import { ValidationFailError } from '../../../shared/index.js';
import { AuxDefinitionNameFinder } from '../../domain/AuxDefinitionNameFinder.js';

export class AuxDefinitionCreator {
    /**
     * @type {KnexAuxDefinitionsRepository}
     * is initialized in the constructor
     */
    #repository;
    /** @type {KnexAuxDefinitionsRepository}*/
    #highPrivilegesRepository;
    /** @type {AuxDefinitionFinder}*/
    #finder;
    /** @type {AuxSchemaExistenceValidator}*/
    #schemaValidator;
    /** @type {RestFlowExistenceValidator}*/
    #restflowValidator;
    /** @type {AuxDefinitionNameFinder} */
    #nameFinder;

    /**
     * @param {KnexAuxDefinitionsRepository} definitionsRepository
     * @param {KnexAuxDefinitionsRepository} definitionsHighPrivilegesRepository
     * @param {KnexSchemasRepository} schemasRepository
     * @param {KnexWSRestFlowRepository} restFlowsRepository
     */
    constructor(definitionsRepository, schemasRepository, restFlowsRepository, definitionsHighPrivilegesRepository) {
        this.#repository = definitionsRepository;
        this.#highPrivilegesRepository = definitionsHighPrivilegesRepository;
        this.#finder = new AuxDefinitionFinder(definitionsRepository);
        this.#schemaValidator = new AuxSchemaExistenceValidator(schemasRepository);
        this.#restflowValidator = new RestFlowExistenceValidator(restFlowsRepository);
        this.#nameFinder = new AuxDefinitionNameFinder(definitionsRepository);
    }

    /**
     * Creates a new AuxDefinition and saves it to the repository.
     * Also creates the associated database tables if they do not exist.
     *
     * @param {Object} dto - Data Transfer Object containing the properties for the new AuxDefinition.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     */
    async execute(dto) {
        const auxDefinition = AuxDefinition.create(dto);

        const exists = await this.#finder.execute(auxDefinition.id.value);
        if (exists) {
            throw new ValidationFailError(`AuxDefinition with id ${auxDefinition.id.value} already exists`, 'id');
        }

        const existsByName = await this.#nameFinder.byName(auxDefinition.name.value);
        if (existsByName) {
            throw new ValidationFailError(
                `AuxDefinition with name '${auxDefinition.name.value}' already exists`,
                'name'
            );
        }

        await this.#schemaValidator.execute(auxDefinition.schema_id);
        if (auxDefinition.restflow_id.value) {
            await this.#restflowValidator.execute(auxDefinition.restflow_id);
        }

        await this.#highPrivilegesRepository.createTables(auxDefinition);

        await this.#repository.save(auxDefinition);
        await this.#repository.saveHistory(auxDefinition);
    }
}
