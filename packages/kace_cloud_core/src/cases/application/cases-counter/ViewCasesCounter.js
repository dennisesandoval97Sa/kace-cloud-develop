export class ViewCasesCounter {
    /**
     * @type {import('../../infrastructure/persistence/KnexViewCaseRepository').KnexViewCaseRepository}
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute() {
        const ans = await this.#repository.getAnsCountsFromView();
        const states = await this.#repository.getStateCountsFromView();
        return {
            data: {
                ans,
                states,
            },
        };
    }
}
