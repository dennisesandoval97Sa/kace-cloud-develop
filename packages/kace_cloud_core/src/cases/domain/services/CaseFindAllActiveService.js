export class CaseFindAllActiveService {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexCaseRepository} repository
     */

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(filters, options = {}) {
        if (Array.isArray(options.restrictToIds) && options.restrictToIds.length === 0) {
            return [];
        }
        return this.#repository.findAllMatchingCondition(filters, options);
    }

    /**
     * Returns only the ids of active cases matching `filters`, ordered and limited
     * per `options` (see KnexCaseRepository.findOrderedIdsMatchingCondition).
     * Used to cap candidate volume before hydrating entities/context.
     */
    async executeOrderedIds(filters, options = {}) {
        if (Array.isArray(options.restrictToIds) && options.restrictToIds.length === 0) {
            return [];
        }
        return this.#repository.findOrderedIdsMatchingCondition(filters, options);
    }
}
