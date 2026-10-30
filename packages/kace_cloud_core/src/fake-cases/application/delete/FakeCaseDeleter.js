import { CustomError, ValueObjectUuid } from '../../../shared/index.js';
import Finder from '../../domain/Finder.js';

export default class FakeCaseDeleter {
    /** @type {KnexFakeCaseRepository} is initialized in the constructor */
    #repository;
    /** @type {Finder} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexFakeCaseRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new Finder(repository);
    }

    /**
     *
     * @param {string} id identificator for search case
     * @returns {Promise<void>}
     */
    async execute(id) {
        const kase = await this.#finder.execute(new ValueObjectUuid('id', id));
        if (!kase) {
            throw new CustomError('The Case you are trying to remove does not exist', 404);
        }

        await this.#repository.delete(kase.id);
    }
}
