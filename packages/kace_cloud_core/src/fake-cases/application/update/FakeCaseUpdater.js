import Finder from '../../domain/Finder.js';
import { CustomError, ValueObjectUuid } from '../../../shared/index.js';

export default class FakeCaseUpdater {
    /** @type {KnexFakeCaseRepository} is initialized in the constructor */
    #repository;
    /** @type {Finder} is initialized in the constructor */
    #finder;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new Finder(repository);
    }

    /**
     *
     * @param {string} id
     * @param {object} dto
     */
    async execute(id, dto) {
        const kase = await this.#finder.execute(new ValueObjectUuid('id', id));

        if (kase === null) {
            throw new CustomError('The FakeCase you are trying update does not exist', 404);
        }

        kase.update(dto);

        await this.#repository.update(kase);

        kase.flushChanges();
    }
}
