import { ValueObjectUuid } from '../../shared';

export class UserListFinder {
    /** @type {KnexUserListsRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `UserListFinder` class.
     *
     * @param {KnexUserListsRepository} repository - An instance of the repository that manages userList records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a userList by their ID.
     *
     * @param {string} id - The UUID of the userList to find.
     * @return {Promise<UserList | null>} A promise that resolves to the `UserList` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
