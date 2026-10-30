import { ValueObjectUuid } from '../../shared/index.js';

export class UserGroupFinder {
    /** @type {KnexUserGroupRelationshipRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `UserGroupFinder` class.
     *
     * @param {KnexNotificacionRepository} repository - An instance of the repository that manages user-group records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a user-group by their ID.
     *
     * @param {string} userId - The UUID of the user to find.
     * @param {string} groupId - The UUID of the group to find.
     * @return {Promise<UserGroupRelationship | null>} A promise that resolves to the `UserGroupRelationship` instance if found, or `null` if not found.
     */
    async execute(userId, groupId) {
        return this.#repository.find(new ValueObjectUuid('userId', userId), new ValueObjectUuid('groupId', groupId));
    }
}
