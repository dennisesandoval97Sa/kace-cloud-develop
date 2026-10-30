import { Counter, Criteria } from '@kace/core/src/shared';
import { KnexEmailsRepository } from '../../infrastructure/persistence/KnexEmailsRepository';
import { EmailCollectionResponse } from '../EmailCollectionResponse';

export class EmailSearch {
    /** @type {KnexEmailsRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;

    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Search for Email according to the given criteria and return a standard collection..
     * @param {Object} dtoCriteria
     * @returns {Promise<EmailCollectionResponse>}
     */
    async execute(dtoCriteria) {
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            this.#repository.tableName
        );
        const rows = await this.#repository.search(criteria);

        const count = await this.#counter.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });

        const countResult = count.count || count['count(*)'];

        return new EmailCollectionResponse(rows, countResult);
    }
}
