import Finder from '../../domain/Finder';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { FakeCasesResponse } from '../FakeCasesResponse.js';

export class FakeCaseFinder {
    /** @type Finder is initialized in the constructor */
    #finder;

    /**
     * @param {KnexFakeCaseRepository} repository
     */
    constructor(repository) {
        this.#finder = new Finder(repository);
    }

    /**
     *
     * @param {string} id
     * @returns {Promise<FakeCasesResponse>}
     */
    async execute(id) {
        const fakeCase = await this.#finder.execute(new ValueObjectUuid('id', id));

        if (!fakeCase) {
            throw new ValidationFailError('Caso no encontrado', 'id');
        }

        return new FakeCasesResponse(fakeCase);
    }
}
