import { FolioConfigurationFinder as DomainFinder } from '../../domain/FolioConfigurationFinder.js';
import { CustomError } from '../../../shared/index.js';

export class FolioConfigurationFinder {
    /** @type {DomainFinder} */
    #finder;

    /**
     * @param {KnexFolioConfigurationRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainFinder(repository);
    }

    /**
     * @param {string} id
     * @returns {Promise<FolioConfiguration>}
     */
    async execute(id) {
        const configuration = await this.#finder.execute(id);

        if (!configuration || configuration.isDeleted()) {
            throw new CustomError(`FolioConfiguration with ID ${id} does not exist.`, 404);
        }

        return configuration;
    }
}
