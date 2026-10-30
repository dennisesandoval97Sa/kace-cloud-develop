import { Criteria } from '../../../shared/criteria/Criteria.js';
import { TemplateAttachmentCollectionResponse } from '../TemplateAttachmentCollectionResponse.js';
import { TemplateAttachmentCounter } from '../../index.js';

export class TemplateAttachmentSearcher {
    /** @type {KnexTemplateAttachmentRepository} is initialized in the constructor */
    #repository;
    /** @type {TemplateAttachmentCounter} is initialized in the constructor */
    #count;

    /**
     * Creates an instance of the `TemplateAttachmentSearcher` class.
     *
     * @param {KnexTemplateAttachmentRepository} repository - An instance of the repository that manages TemplateAttachment records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new TemplateAttachmentCounter(repository);
    }

    /**
     * Searches for TemplateAttachment records based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching TemplateAttachment records. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<TemplateAttachmentCollectionResponse>} A promise that resolves to an instance of `TemplateAttachmentCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#count.execute({ filter, relationship });

        return new TemplateAttachmentCollectionResponse(rows, counter);
    }
}
