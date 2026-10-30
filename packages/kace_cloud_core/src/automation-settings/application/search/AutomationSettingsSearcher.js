import { Criteria } from '../../../shared/criteria/Criteria.js';
import { AutomationSettingsCollectionResponse } from '../AutomationSettingsCollectionResponse.js';
import { AutomationSettingsCounter } from '../../domain/AutomationSettingsCounter.js';

export class AutomationSettingsSearcher {
    /** @type {KnexAutomationSettingsRepository} is initialized in the constructor */
    #repository;
    /** @type {AutomationSettingsCounter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `AutomationSettingsSearcher` class.
     *
     * @param {KnexAutomationSettingsRepository} repository - An instance of the repository that manages AutomationSettings records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new AutomationSettingsCounter(repository);
    }

    /**
     * Searches for AutomationSettings based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching AutomationSettings. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<AutomationSettingsCollectionResponse>} A promise that resolves to an instance of `AutomationSettingsCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({ filter, relationship });

        return new AutomationSettingsCollectionResponse(rows, counter.count);
    }
}
