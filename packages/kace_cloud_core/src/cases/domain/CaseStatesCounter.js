export class CaseStatesCounter {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(filters) {
        return this.#repository.getCountsWithReferences(filters);
    }
}
