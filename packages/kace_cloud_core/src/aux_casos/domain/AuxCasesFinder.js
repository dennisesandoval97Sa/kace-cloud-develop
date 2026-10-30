import { ValueObjectUuid } from '../../shared';

export class AuxCasesFinder {
    /** @type {KnexAuxCasesRepository} is initialized in the constructor */
    #repository;
    /**
     *
     * @param {KnexAuxCasesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id identificator for record to find
     * @returns {Promise<AuxCases>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
