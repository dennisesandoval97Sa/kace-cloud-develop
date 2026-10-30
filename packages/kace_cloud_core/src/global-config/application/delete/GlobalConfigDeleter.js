import { DomainConfigFinder } from '../../index';
import { CustomError } from '../../../shared/errors/CustomError';

export class GlobalConfigDeleter {
    /** @type {KnexGlobalConfigurationRepository} is initialized in the constructor*/
    #repository;

    /**
     * @type {DomainConfigFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     *
     * @param {KnexGlobalConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainConfigFinder(repository);
    }

    /**
     *
     * @param {String} id
     */
    async execute(id, dto) {
        const config = await this.#finder.execute(id);
        if (config === null) {
            throw new CustomError(`The global config you are trying delete does not exist`, 404);
        }

        config.delete(dto);
        await this.#repository.delete(config);

        config.flushChanges();
    }
}
