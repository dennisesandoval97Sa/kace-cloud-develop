import { DomainOneScriptFinder } from '../..';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { OneScript } from '../../domain/OneScript';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { SchemaFinder } from '../../../schemas/domain/SchemaFinder.js';

export class OneScriptCreator {
    /** @type {KnexOneScriptRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainOneScriptFinder} is initialized in the constructor */
    #finder;
    /** @type { UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /** @type {SchemaFinder} is initialized in the constructor */
    #SchemaFinder;

    /**
     * Creates an instance of the `OneScriptCreator` class.
     *
     * @param {KnexOneScriptRepository} repository - Repository that manages OneScript records.
     * @param {KnexSchemasRepository} schemaRepository - Repository to validate schema existence.
     */

    constructor(repository, schemaRepository) {
        this.#repository = repository;
        this.#finder = new DomainOneScriptFinder(repository);
        this.#SchemaFinder = new SchemaFinder(schemaRepository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    async execute(dto) {
        if (!dto) throw new Error('dto cannot be null or undefined');

        if (dto.schema_id) {
            const schemaResponse = await this.#SchemaFinder.executeIfActive(dto.schema_id);
            if (!schemaResponse || !schemaResponse.id?.value) {
                throw new CustomError(`The schema_id '${dto.schema_id}' does not exist or is not active.`, 400);
            }
        }

        const oneScript = new OneScript(dto);
        const result = await this.#finder.execute(oneScript.id.value);

        if (result) {
            throw new CustomError(`OneScript with id ${oneScript.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('name', dto.name);

        await this.#repository.save(oneScript);
        await this.#repository.saveHistory(oneScript);
    }
}
