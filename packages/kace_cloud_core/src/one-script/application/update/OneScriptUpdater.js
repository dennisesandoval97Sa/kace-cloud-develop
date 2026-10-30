import { DomainOneScriptFinder } from '../../index.js';
import { CustomError } from '../../../shared/index.js';
import { SchemaFinder } from '../../../schemas/domain/SchemaFinder.js';

export class OneScriptUpdater {
    /** @type {DomainOneScriptFinder} */
    #oneScriptFinder;
    /** @type {KnexOneScriptRepository} */
    #repository;
    /** @type {SchemaFinder} */
    #SchemaFinder;

    /**
     * Creates an instance of the `OneScriptUpdater` class.
     *
     * @param {KnexOneScriptRepository} repository - Repository that manages OneScript records.
     * @param {KnexSchemasRepository} schemaRepository - Repository to validate schema existence.
     */
    constructor(repository, schemaRepository) {
        this.#repository = repository;
        this.#oneScriptFinder = new DomainOneScriptFinder(repository);
        this.#SchemaFinder = new SchemaFinder(schemaRepository);
    }

    /**
     * Updates an `OneScript` object in the repository.
     *
     * @param {string} id - The unique identifier of the `OneScript` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update.
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const oneScript = await this.#oneScriptFinder.execute(id);

        if (!oneScript) {
            throw new CustomError(`OneScript with ID ${id} does not exist.`, 404);
        }

        if (dto.schema_id) {
            const schemaResponse = await this.#SchemaFinder.executeIfActive(dto.schema_id);
            if (!schemaResponse || !schemaResponse.id?.value) {
                throw new CustomError(`The schema_id '${dto.schema_id}' does not exist or is not active.`, 400);
            }
        }

        const originalValues = oneScript.toJson();
        oneScript.update(dto);

        await this.#repository.update(oneScript);
        await this.#repository.saveHistory(oneScript, originalValues);

        oneScript.flushChanges();
    }
}
