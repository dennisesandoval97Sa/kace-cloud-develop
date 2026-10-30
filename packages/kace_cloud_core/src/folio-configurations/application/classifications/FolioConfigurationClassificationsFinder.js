import { FolioConfigurationFinder } from '../../domain/FolioConfigurationFinder.js';
import { CustomError } from '../../../shared/index.js';

/** Same composition ClassificationResponse uses, so the label reads the same everywhere. */
const LEVELS = Array.from({ length: 10 }, (_, index) => `nivel${index + 1}`);

/**
 * Lists the classifications attached to a configuration.
 *
 * Read-only: the association is written from the classification form, which sets
 * `clasificaciones.folio_config_id`. The folio screen only shows the result, so there is a
 * single place where this relationship is edited.
 */
export class FolioConfigurationClassificationsFinder {
    /** @type {KnexFolioConfigurationRepository} */
    #repository;

    /** @type {FolioConfigurationFinder} */
    #finder;

    /**
     * @param {KnexFolioConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new FolioConfigurationFinder(repository);
    }

    /**
     * @param {string} id
     * @returns {Promise<Array<{id: string, description: string}>>}
     */
    async execute(id) {
        const configuration = await this.#finder.execute(id);

        if (!configuration || configuration.isDeleted()) {
            throw new CustomError(`FolioConfiguration with ID ${id} does not exist.`, 404);
        }

        const rows = await this.#repository.findClassifications(id);

        return rows.map((row) => ({
            id: row.id,
            description: LEVELS.map((level) => row[level])
                .filter(Boolean)
                .join(' -> '),
        }));
    }
}
