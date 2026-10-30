import { CaseGroupsCounter } from '../../domain/CaseGroupsCounter';

export class CasesGroupCounter {
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
        const groups = await new CaseGroupsCounter(this.#repository).execute(filters);
        return {
            data: {
                groups,
            },
        };
    }
}
