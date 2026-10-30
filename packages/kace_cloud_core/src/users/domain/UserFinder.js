import { ValueObjectUuid } from '../../shared/index.js';

export class UserFinder {
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
     * Finds a user by their ID.
     *
     * @param {string} id - The UUID of the user to find.
     * @return {Promise<User>} A promise that resolves to the `User` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
