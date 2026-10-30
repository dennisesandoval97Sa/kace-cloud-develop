import { CustomError } from '../../../shared/index.js';
import { BannerResponse, DomainBannerFinder } from '../../index.js';

export class BannerFinder {
    /** @type {DomainBannerFinder} is initialized in the constructor */
    #finder;

    constructor(repository) {
        this.#finder = new DomainBannerFinder(repository);
    }

    /**
     * Executes the finding of a Banner object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Banner object to find.
     * @returns {Promise<BannerResponse>} A promise that resolves to a BannerResponse object containing the found Banner data.
     */
    async execute(id) {
        const banner = await this.#finder.execute(id);
        if (!banner || banner.isDeleted()) {
            throw new CustomError('Banners not found', 404);
        }

        return new BannerResponse(banner);
    }
}
