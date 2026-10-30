import { Criteria } from '../../../shared/index.js';
import { WorkspacesCounter } from '../../domain/WorkspacesCounter.js';
import { WorkspaceCollectionResponse } from '../WorkspaceCollectionResponse.js';

export class WorkspaceSearcher {
    /**
     * @type {KnexWorkspacesRepository}
     * is initialized in the constructor
     */
    #repository;

    /** @type {WorkspacesCounter} is initialized in the constructor */
    #counter;

    /**
     *
     * @param {KnexWorkspacesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new WorkspacesCounter(repository);
    }

    /**
     *
     * @param {object} dtoCriteria criteria for filter workspaces
     * @returns {Promise<WorkspaceCollectionResponse>}
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationships,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );

        const result = await this.#repository.search(criteria);
        const counter = await this.#counter.execute(dtoCriteria);

        return new WorkspaceCollectionResponse(result, counter.count);
    }
}
