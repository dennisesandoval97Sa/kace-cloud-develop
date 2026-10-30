import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { Banner, DomainBannerFinder } from '../../index';

export class BannerCreator {
    /** @type {KnexBannersRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainBannerFinder} is initialized in the constructor */
    #bannerFinder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#bannerFinder = new DomainBannerFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the creation of a Banner object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the Banner object.
     * @returns {Promise<void>} A promise that resolves when the Banner object is saved.
     */
    async execute(dto) {
        const banner = Banner.create(dto);

        const result = await this.#bannerFinder.execute(banner.id.value);
        if (result) {
            throw new CustomError(`Banner with id ${banner.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('descripcion', dto.descripcion);
        await this.#repository.save(banner);
        await this.#repository.saveHistory(banner);
    }
}
