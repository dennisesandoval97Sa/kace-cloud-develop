import { ValueObjectUuid, CustomError, Helper } from '../../../shared/index.js';
import { DomainAdapterFinder } from '../../domain/DomainAdapterFinder.js';

export class AdapterDeleter {
    /** @type {Object} repository */
    #repository;

    /** @type {DomainAdapterFinder} */
    #adapterFinder;

    /**
     * @param {Object} repository - repository implementing delete and findById and saveHistory
     */
    constructor(repository) {
        this.#repository = repository;
        this.#adapterFinder = new DomainAdapterFinder(repository);
    }

    /**
     * Delete an adapter settings by id after validating existence.
     * @param {string} id
     */
    async execute(id) {
        const validId = new ValueObjectUuid('id', id).value;

        const existing = await this.#adapterFinder.execute(validId);
        if (!existing) throw new CustomError(`Adapter with id ${validId} not found`, 404);

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
