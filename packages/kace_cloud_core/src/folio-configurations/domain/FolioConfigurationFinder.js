import { ValueObjectUuid } from '../../shared/index.js';

export class FolioConfigurationFinder {
    /**
     * @type {KnexFolioConfigurationRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @param {KnexFolioConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {string} id
     * @returns {Promise<FolioConfiguration | null>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
