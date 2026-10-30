import { CaseResponsibleCounter } from '../../domain/CaseResponsibleCounter';

export class CasesResponsibleCounter {
    /**
     * @type {KnexCaseRepository}
     * is initialized in the constructor
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }
    /**
     *
     * @param {Array}
     * @returns {Object}
     */
    async execute(filters = {}) {
        const responsible = await new CaseResponsibleCounter(this.#repository).execute(filters);
        return {
            data: {
                responsible,
            },
        };
    }
}
