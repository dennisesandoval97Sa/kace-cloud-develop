import { ValueObjectUuid, CustomError, Helper } from '../../../shared/index.js';
import { DomainMapperFinder } from '../../domain/DomainMapperFinder.js';

export class MapperDeleter {
    /** @type {Object} repository */
    #repository;

    /** @type {DomainMapperFinder} */
    #mapperFinder;

    /**
     * @param {Object} repository - repository implementing delete and findById and saveHistory
     */
    constructor(repository) {
        this.#repository = repository;
        this.#mapperFinder = new DomainMapperFinder(repository);
    }

    /**
     * Delete a mapper by id after validating existence.
     * @param {string} id
     */
    async execute(id) {
        const validId = new ValueObjectUuid('id', id).value;

        const existing = await this.#mapperFinder.execute(validId);
        if (!existing) throw new CustomError(`Mapper with id ${validId} not found`, 404);

        const result = await this.#repository.delete(validId);

        if (this.#repository.saveHistory) {
            try {
                await this.#repository.saveHistory({ id: validId, deleted: true });
            } catch (e) {
                Helper.logError(e);
                // do not block deletion for history failure
            }
        }

        return result;
    }
}
