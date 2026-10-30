import { ValueObjectUuid } from '../../../shared';
import { UserCollectionResponse } from '../../index';

export class UserFinderByGroup {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `UserFinder` class.
     *
     * @param {KnexUsersRepository} repository - An instance of the repository that manages user records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the finding of an User object by its unique identifier.
     *
     * @param {string} groupId - The unique identifier of the Group object to find.
     * @returns {Promise<UserCollectionResponse>} A promise that resolves to an UserResponse object containing the found User data.
     */
    async execute(groupId) {
        const user = await this.#repository.getUserByGroupId(new ValueObjectUuid('Group id', groupId));
        return new UserCollectionResponse(user);
    }
}
