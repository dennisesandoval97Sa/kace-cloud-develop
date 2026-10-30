import { FolioConfiguration } from '../../domain/FolioConfiguration.js';
import { FolioConfigurationFinder } from '../../domain/FolioConfigurationFinder.js';
import { FolioConfigurationLayoutGuard } from '../../domain/FolioConfigurationLayoutGuard.js';
import { CustomError, UniquenessValidator } from '../../../shared/index.js';

export class FolioConfigurationCreator {
    /** @type {KnexFolioConfigurationRepository} */
    #repository;

    /** @type {FolioConfigurationFinder} */
    #finder;

    /** @type {UniquenessValidator} */
    #uniquenessValidator;

    /** @type {FolioConfigurationLayoutGuard} */
    #layoutGuard;

    /**
     * @param {KnexFolioConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new FolioConfigurationFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#layoutGuard = new FolioConfigurationLayoutGuard(repository);
    }

    /**
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    async execute(dto) {
        if (!dto) throw new Error('dto cannot be null or undefined');

        // The constructor validates the segment list, so a configuration that could never
        // produce a valid folio is rejected here rather than when the first case is created.
        const configuration = FolioConfiguration.create(dto);

        const result = await this.#finder.execute(configuration.id.value);
        if (result) {
            throw new CustomError(`FolioConfiguration with id ${configuration.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('nombre', dto.nombre);
        await this.#layoutGuard.ensureUnique(configuration);

        await this.#repository.save(configuration);
        await this.#repository.saveHistory(configuration);
    }
}
