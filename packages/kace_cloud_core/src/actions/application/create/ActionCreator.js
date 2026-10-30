import { Action, DomainActionFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { SchemaRules } from '../../../schemas/application/rules/SchemaRules.js';
import { ActionSchemaPathValidator } from '../../domain/validators/ActionSchemaPathValidator.js';

export class ActionCreator {
    /**
     * @type {KnexActionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainActionFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {UniquenessValidator}
     * is initialized in the constructor
     */
    #uniquenessValidator;

    /**
     * @type {SchemaRules}
     * is initialized in the constructor
     */
    #schemaRules;

    /**
     * @param {KnexActionRepository} repository
     * @param {SchemaRules} schemaRules
     */
    constructor(repository, schemaRules) {
        this.#repository = repository;
        this.#finder = new DomainActionFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#schemaRules = schemaRules;
    }

    /**
     * Executes the process of creating a new action.
     * @param {Object} dto - The data transfer object containing the properties for the Action object.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        if (!dto) throw new Error('dto cannot be null or undefined');

        const action = new Action(dto);
        action.validate();

        const result = await this.#finder.execute(action.id.value);
        if (result) {
            throw new CustomError(`Action with id ${action.id.value} already exists`, 400);
        }

        const path = action.external_group_dynamic_code.value || action.external_user_dynamic_code.value;
        if (path) {
            let isValidPath = false;
            const schemaId = await this.#repository.getAuxCasesSchemaId();
            if (schemaId) {
                const dataStructure = await this.#schemaRules.execute(schemaId);
                isValidPath = ActionSchemaPathValidator.validate(dataStructure.toJson().data, path);
            }
            if (!isValidPath) throw new CustomError('Dynamic code path not exist');
        }

        await this.#uniquenessValidator.validate('description', dto.description);

        await this.#repository.save(action);
        await this.#repository.saveHistory(action);
    }
}
