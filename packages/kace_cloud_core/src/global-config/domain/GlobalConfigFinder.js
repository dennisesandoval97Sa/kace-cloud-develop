import { ValueObjectUuid } from '../../shared';

export class GlobalConfigFinder {
    /** @type {KnexGlobalConfigurationRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexGlobalConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {String} id
     * @returns {Promise<GlobalConfiguration>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
