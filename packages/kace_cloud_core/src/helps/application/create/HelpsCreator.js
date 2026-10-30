import { CustomError } from '../../../shared/errors/CustomError';
import { Helps, HelpsFinderDomain } from '../../index';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';

export class HelpsCreator {
    /** @type {KnexHelpsRepository} is initialized in the constructor */
    #repository;
    /** @type {HelpsFinderDomain} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /**
     *
     * @param {KnexHelpsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new HelpsFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     *
     * @param {object} dto data to insert a new help
     * @returns {Promise<Any>}
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new CustomError('dto cannot be null or undefined', 400);

        const creator = Helps.create(dto);

        const result = await this.#finder.execute(creator.id.value);
        if (result) {
            throw new CustomError(`Help with id ${creator.id.value} already exists`, 400);
        }
        await this.#uniquenessValidator.validate('titulo', dto.titulo);

        await this.#repository.save(creator);
        await this.#repository.saveHistory(creator);

        return creator;
    }
}
