export class ViewCasesResponsibleCounter {
    /**
     * @type {import('../../infrastructure/persistence/KnexViewCaseRepository').KnexViewCaseRepository}
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute() {
        const responsible = await this.#repository.getResponsibleCountsFromView();
        return {
            data: {
                responsible,
            },
        };
    }
}
