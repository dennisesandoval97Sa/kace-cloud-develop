import { Criteria } from '../criteria/Criteria';

export class HistoryCounter {
    /**@type {KnexRepository} is initialized in the constructor */
    #repository;
    /**@type {string} is initialized in the constructor, if not provided it will use the repository's table name */
    #tableName;

    /**
     *
     * @param {KnexRepository} repository
     */
    constructor(repository, tableName = null) {
        this.#repository = repository;
        this.#tableName = tableName;
    }

    /**
     *
     * @param {object} dtoCriteria criteria object for search
     * @returns {Promise<number>}
     */
    async execute(dtoCriteria, entityId) {
        const tablename = this.#tableName ?? this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);
        return this.#repository.historyCounter(criteria, tablename, entityId);
    }
}
