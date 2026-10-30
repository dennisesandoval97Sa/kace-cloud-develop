import { CustomError } from '../../../shared/errors/CustomError.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { DomainBannerFinder } from '../../index.js';

export class BannerUpdater {
    /** @type {DomainBannerFinder} is initialized in the constructor */
    #bannerFinder;
    /** @type {KnexBannersRepository} is initialized in the constructor */
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#bannerFinder = new DomainBannerFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates a Banner object in the repository.
     *
     * @param {string} id - The unique identifier of the Banner object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the Banner object.
     * @returns {Promise<void>} A promise that resolves when the Banner object is updated.
     */
    async execute(id, dto) {
        const banner = await this.#bannerFinder.execute(id);

        if (!banner) {
            throw new CustomError(`Banner with id ${id} does not exist.`, 404);
        }

        if (dto.descripcion) {
            await this.#uniquenessValidator.validate('descripcion', dto.descripcion, id);
        }
        const originalValues = banner.toJson();
        banner.update(dto);

        await this.#repository.update(banner);
        await this.#repository.saveHistory(banner, originalValues);

        banner.flushChanges();
    }
}
