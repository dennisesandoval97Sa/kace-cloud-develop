import { DomainUserGroupFinder, UserGroupResponse } from '../../index.js';

export class UserGroupFinder {
    /** @type {DomainUserGroupFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `UserGroupFinder` class.
     *
     * @param {KnexUserGroupRelationshipRepository} repository - An instance of the repository that manages user group relation records.
     */
    constructor(repository) {
        this.#finder = new DomainUserGroupFinder(repository);
    }

    /**
     * Executes the finding of a `UserGroupRelationship` object by its unique identifier.
     *
     * @param {string} userId - The unique identifier of the `User` object to find.
     * @param {string} groupId - The unique identifier of the `Group` object to find.
     * @returns {Promise<UserGroupResponse>} A promise that resolves to a `UserGroupResponse` object containing the found user group relation data.
     */
    async execute(userId, groupId) {
        const userGroup = await this.#finder.execute(userId, groupId);
        return new UserGroupResponse(userGroup);
    }
}
