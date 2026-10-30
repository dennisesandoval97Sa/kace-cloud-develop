import { FolioConfigurationFinder } from '../../domain/FolioConfigurationFinder.js';
import { CustomError } from '../../../shared/index.js';

export class FolioConfigurationDeleter {
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
     * Soft-deletes a configuration.
     *
     * Deleting one that is still attached to classifications is refused rather than done
     * silently: those cases would quietly stop getting a folio, which for a legal
     * identifier is the kind of thing nobody notices until an audit. Detach them first.
     *
     * The counters in `folio_sequences` are deliberately NOT removed. They are the memory
     * of which numbers have already been handed out; dropping them would restart the
     * consecutive and re-issue folios that already exist on real cases.
     *
     * @param {string} id
     * @param {Object} dto - Must include deleted_by and deleted_at
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const configuration = await this.#finder.execute(id);

        if (!configuration) {
            throw new CustomError(`FolioConfiguration with ID ${id} does not exist.`, 404);
        }

        const attached = await this.#repository.findClassifications(id);
        if (attached.length) {
            throw new CustomError(
                `No se puede eliminar la configuración: está asociada a ${attached.length} clasificación(es). ` +
                    `Desasócielas primero.`,
                400
            );
        }

        const originalValues = configuration.toJson ? configuration.toJson() : {};
        configuration.delete(dto);

        await this.#repository.update(configuration);
        await this.#repository.saveHistory(configuration, originalValues);
        configuration.flushChanges();
    }
}
