import { DomainUserListFinder } from '../../index';

export class UserListDeleter {
    /** @type {KnexUserListsRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainUserListFinder} is initialized in the constructor */
    #userListFinder;

    /**
     * Creates an instance of the `UserListDeleter` class.
     *
     * @param {KnexUserListsRepository} repository - An instance of the repository that manages userList records.
     */
    constructor(repository) {
        this.#userListFinder = new DomainUserListFinder(repository);
        this.#repository = repository;
    }
    /**
     * Deletes an UserList object from the repository.
     *
     * This method finds the userList by their ID, applies deletion operations, updates the repository with the modified userList object, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the userList object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the userList object.
     * @returns {Promise<void>} A promise that resolves when the userList object is deleted.
     */
    async execute(id, dto) {
        const userList = await this.#userListFinder.execute(id);

        if (!userList) return;

        const originalValues = userList.toJson();
        userList.delete(dto);

        await this.#repository.update(userList);
        await this.#repository.saveHistory(userList, originalValues);

        userList.flushChanges();
    }
}
