export class CaseGroupsCounter {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(filters) {
        const [counterResponse] = await this.#repository.casesCounterByGroup(filters);
        return counterResponse;
    }
}
