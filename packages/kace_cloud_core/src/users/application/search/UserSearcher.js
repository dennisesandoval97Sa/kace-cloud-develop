import { AnsCasesCounter, Criteria, Helper } from '../../../shared/index.js';
import { UserCollectionResponse } from '../UserCollectionResponse';
import { Counter } from '../../../shared/domain/Counter';
import { EventLogger } from '../../../shared/EventLogger.js';

export class UserSearcher {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;
    /** @type {AnsCasesCounter} is initialized in the constructor */
    #serviceAnsCases;
    /** @type {Counter} is initialized in the constructor */
    #counter;
    /**
     * Creates an instance of the `UserSearcher` class.
     *
     * @param {KnexUsersRepository} repository - An instance of the repository that manages user records.
     * @param casesRepository
     */
    constructor(repository, casesRepository) {
        this.#repository = repository;
        this.#serviceAnsCases = new AnsCasesCounter(casesRepository);
        this.#counter = new Counter(repository);
        this.eventLogger = new EventLogger(repository);
    }

    /**
     * Searches for users based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching users. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<UserCollectionResponse>} A promise that resolves to an instance of `UserCollectionResponse` containing the search results.
     */
    async execute(dtoCriteria) {
        Helper.logDebug(`Begin UserSearcher.execute at ${new Date().toISOString()}`);
        Helper.logTime('UserQuery');
        const tablename = this.#repository.tableName;

        const rawFilters = dtoCriteria.filter || [];
        const groupFilter = rawFilters.find((f) => f.field === 'grupos_ids');
        const cleanFilters = groupFilter ? rawFilters.filter((f) => f.field !== 'grupos_ids') : rawFilters;
        const groupIds = groupFilter
            ? groupFilter.value
                  .toString()
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
            : null;

        const criteria = new Criteria(
            cleanFilters,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );
        const rows = await this.#repository.search(criteria, groupIds);
        Helper.logTimeEnd('UserQuery');

        Helper.logTime('GroupsEnrichment');
        const usersWithGroups = await this.#addGroupsData(rows);
        Helper.logTimeEnd('GroupsEnrichment');

        Helper.logTime('CasesCounter');
        const usersWithCasesCount = await this.#addCasesCounter(usersWithGroups);
        Helper.logTimeEnd('CasesCounter');

        Helper.logTime('CountQuery');
        const count =
            groupIds?.length > 0
                ? await this.#repository.countUsers(cleanFilters, dtoCriteria.relationship, groupIds)
                : await this.#counter.execute({ filter: cleanFilters, relationship: dtoCriteria.relationship });
        const countResult = count.count || count['count(*)'];
        Helper.logTimeEnd('CountQuery');

        Helper.logDebug(`End UserSearcher.execute at ${new Date().toISOString()}`);
        return new UserCollectionResponse(usersWithCasesCount, countResult);
    }

    async #addGroupsData(users) {
        Helper.logDebug(`Begin addGroupsData at ${new Date().toISOString()}`);
        if (!users.length) return users;

        const userIds = users.map((user) => user.id.value);
        const groupsByUser = await this.#repository.findGroupsByUserIds(userIds);

        users.forEach((user) => {
            user.groups = groupsByUser.get(user.id.value) || [];
        });

        Helper.logDebug(`End addGroupsData at ${new Date().toISOString()}`);
        return users;
    }

    /**
     * Adds case counters to each user.
     *
     * @param {Array} users - Array of user objects with an id property.
     * @returns {Promise<Array<User>>} - Resolves to an array of users with added
     */
    async #addCasesCounter(users) {
        Helper.logDebug(`Begin addCasesCounter at ${new Date().toISOString()}`);

        if (!users.length) return users;

        const userIds = users.map((user) => user.id.value);
        const casesCountMap = await this.#serviceAnsCases.executeForMultiple('responsible', userIds);

        const result = users.map((user) => {
            const counts = casesCountMap.get(user.id.value) || {
                expired: 0,
                intermediate: 0,
                notExpired: 0,
            };

            user.notExpiredCasesCount = { count: counts.notExpired };
            user.intermediateCasesCount = { count: counts.intermediate };
            user.expiredCasesCount = { count: counts.expired };
            return user;
        });

        Helper.logDebug(`End addCasesCounter at ${new Date().toISOString()}`);
        return result;
    }
}
