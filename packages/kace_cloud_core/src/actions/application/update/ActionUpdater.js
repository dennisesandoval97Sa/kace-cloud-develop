import { SchemaRules } from '../../../schemas/application/rules/SchemaRules.js';
import { UniquenessValidator } from '../../../shared/index.js';
import { ActionSchemaPathValidator } from '../../domain/validators/ActionSchemaPathValidator.js';
import { DomainActionFinder } from '../../index.js';

export class ActionUpdater {
    /**
     * @type {DomainActionFinder}
     * is initialized in the constructor
     */
    #actionFinder;

    /**
     * @type {KnexActionRepository}
     * is initialized in the constructor
     */
    #repository;

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
     * Creates an instance of the `ActionUpdater` class.
     *
     * @param {KnexActionRepository} repository - An instance of the repository that manages Action records.
     * @param {SchemaRules} schemaRules
     */
    constructor(repository, schemaRules) {
        this.#repository = repository;
        this.#actionFinder = new DomainActionFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#schemaRules = schemaRules;
    }

    /**
     * Updates an `Action` object in the repository.
     *
     * @param {string} id - The unique identifier of the `Action` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `Action` object.
     * @returns {Promise<void>} A promise that resolves when the `Action` object is updated.
     */
    async execute(id, dto) {
        const action = await this.#actionFinder.execute(id);

        if (!action) {
            throw new Error(`Action with ID ${id} does not exist.`);
        }

        const originalValues = action.toJson();
        action.update(dto);
        action.validate();

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

        if (dto.description) {
            await this.#uniquenessValidator.validate('description', dto.description, id);
        }

        await this.#repository.update(action);
        await this.#repository.saveHistory(action, originalValues);
        action.flushChanges();
    }
}
