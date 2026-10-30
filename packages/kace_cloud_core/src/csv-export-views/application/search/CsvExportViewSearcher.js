import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/index.js';
import { CsvExportViewCollectionResponse } from '../../index.js';

export class CsvExportViewSearcher {
    /**
     * @type {KnexCsvExportViewRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {Counter}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of the `CsvExportViewSearcher` class.
     *
     * @param {KnexCsvExportViewRepository} repository - An instance of the repository that manages CsvExportView records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new Counter(repository);
    }

    /**
     * Searches for CsvExportView records based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching CsvExportView records. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<CsvExportViewCollectionResponse>} A promise that resolves to an instance of `CsvExportViewCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#count.execute({ filter, relationship });

        return new CsvExportViewCollectionResponse(rows, counter);
    }
}
