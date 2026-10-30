import { Criteria } from '../../shared/criteria/Criteria.js';
import { KnexRepository } from '../../shared/infrastructure/persistence/KnexRepository.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';

export class UnfilteredCounter {
    /**@type {KnexRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of UnfilteredCounter.
     * @param {KnexRepository} repository - The repository instance to use for counting
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes a count query without applying soft delete filters.
     * This method counts all records matching the criteria, including deleted ones.
     *
     * @param {object} dtoCriteria - Criteria object for search containing:
     *   - filter: Array of filter conditions
     *   - relationship: Relationship configurations
     * @returns {Promise<number>} The total count of records matching the criteria
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);
        return this.#countImportDashboardSearch(criteria);
    }

    /**
     * Private method to execute count query without applying deleted_at filter.
     * This bypasses the repository's default soft delete behavior.
     *
     * @param {Criteria} criteria - The criteria object
     * @returns {Promise<number>} The count result
     * @private
     */
    async #countImportDashboardSearch(criteria) {
        try {
            const query = criteria.convertToKnex(this.#repository.read.table(this.#repository.tableName).count());
            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error in UnfilteredCounter:', error);
            throw new QueryDBError('unfiltered-count');
        }
    }
}
