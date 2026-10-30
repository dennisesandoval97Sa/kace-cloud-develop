import Finder from '../../domain/Finder.js';
import FakeCases from '../../domain/FakeCases.js';
import { ValidationFailError } from '../../../shared/index.js';
import { FakeCasesResponse } from '../FakeCasesResponse.js';

export class FakeCaseCreator {
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
     * @param {object} dto object with data to create a case
     * @returns {Promise<FakeCasesResponse>}
     */
    async execute(dto) {
        const fakeCase = FakeCases.create(dto);

        const result = await this.#finder.execute(fakeCase.id);
        if (result) {
            throw new ValidationFailError(`Id ${fakeCase.id.value} already exists`, 'id');
        }

        await this.#repository.save(fakeCase);
        return new FakeCasesResponse(fakeCase);
    }
}
