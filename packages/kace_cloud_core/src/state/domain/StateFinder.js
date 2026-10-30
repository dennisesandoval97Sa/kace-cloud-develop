import { ValueObjectUuid } from '../../shared';

export class StateFinder {
    /** @type {KnexStateRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the finding of an State object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the State object to find.
     * @returns {Promise<StateResponse>} A promise that resolves to an StateResponse object containing the found State data.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
