import { CaseAnsCounter } from '../../domain/CaseAnsCounter';
import { CaseStatesCounter } from '../../domain/CaseStatesCounter';

export class CasesCounter {
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
     * @param {Object} filters
     * @param {String} filters.field campo por el que se desea filtrar
     * @param {String} filters.valor valor del campo por el que se desea filtrar
     * @returns {Object}
     */
    async execute(filters = {}) {
        const ans = await new CaseAnsCounter(this.#repository).execute(filters);
        const states = await new CaseStatesCounter(this.#repository).execute(filters);
        return {
            data: {
                ans,
                states,
            },
        };
    }
}
