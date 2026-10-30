export class ViewCasesGroupCounter {
    /**
     * @type {import('../../infrastructure/persistence/KnexViewCaseRepository').KnexViewCaseRepository}
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute() {
        const groups = await this.#repository.getGroupCountsFromView();
        return {
            data: {
                groups,
            },
        };
    }
}
