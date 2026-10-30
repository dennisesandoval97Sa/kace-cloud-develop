export class CaseResponsibleCounter {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(filters) {
        const [counterResponse] = await this.#repository.casesCounterByResponsible(filters);
        return counterResponse;
    }
}
