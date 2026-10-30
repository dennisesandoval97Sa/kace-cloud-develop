import { DomainUserGroupFinder } from '../../index';

export class UserGroupDeleter {
    /** @type {KnexUserGroupRelationshipRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainUserGroupFinder} is initialized in the constructor */
    #userGroupFinder;

    /**
     * Creates an instance of the `UserGroupDeleter` class.
     *
     * @param {KnexUserGroupRelationshipRepository} repository - An instance of the repository that manages user group records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#userGroupFinder = new DomainUserGroupFinder(repository);
    }

    /**
     * Deletes an user group relation object from the repository.
     *
     * @param {string} userId - The unique identifier of the user object to delete.
     * @param {string} groupId - The unique identifier of the group object to delete.
     * @returns {Promise<void>} A promise that resolves when the user group relation object is deleted.
     * @throws {Error} Throws an error if the user group relation object does not exist.
     */
    async execute(userId, groupId) {
        const userGroup = await this.#userGroupFinder.execute(userId, groupId);
        if (!userGroup) {
            throw new Error(`Relation with userId ${userId} and groupId ${groupId} does not exist.`);
        }

        await this.#repository.delete(userGroup);
    }
}
