import { CustomError } from '../../../shared/index.js';
import { DomainUserListFinder, UserListResponse } from '../../index.js';

export class UserListFinder {
    /** @type {DomainUserListFinder} is initialized in the constructor */
    #userListFinder;

    /**
     * Creates an instance of the `UserListFinder` class.
     *
     * @param {KnexUserListsRepository} repository - An instance of the repository that manages userList records.
     */
    constructor(repository) {
        this.#userListFinder = new DomainUserListFinder(repository);
    }

    /**
     * Finds a userList by their ID.
     *
     * @param {string} id - The UUID of the userList to find.
     * @return {Promise<UserList>} A promise that resolves to the `UserList` instance if found, or `null` if not found.
     */
    async execute(id) {
        const userList = await this.#userListFinder.execute(id);
        if (!userList || userList.isDeleted()) {
            throw new CustomError('Users list not found', 404);
        }
        return new UserListResponse(userList);
    }
}
