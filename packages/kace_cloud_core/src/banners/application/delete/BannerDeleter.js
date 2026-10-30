import { DomainBannerFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class BannerDeleter {
    /** @type {DomainBannerFinder} is initialized in the constructor */
    #bannerFinder;
    /** @type {KnexBannersRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
        this.#bannerFinder = new DomainBannerFinder(repository);
    }

    /**
     * Deletes a Banner object from the repository.
     *
     * @param {string} id - The unique identifier of the Banner object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the Banner object.
     * @returns {Promise<void>} A promise that resolves when the Banner object is deleted.
     */
    async execute(id, dto) {
        const banner = await this.#bannerFinder.execute(id);

        if (!banner) {
            throw new CustomError(`Banner with id ${id} does not exist.`, 404);
        }

        const originalValues = banner.toJson();
        banner.delete(dto);

        await this.#repository.delete(banner);
        await this.#repository.saveHistory(banner, originalValues);

        banner.flushChanges();
    }
}
