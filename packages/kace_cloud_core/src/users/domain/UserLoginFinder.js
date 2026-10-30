import { ValueObjectLogin } from './ValueObjectLogin.js';

export class UserLoginFinder {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `UserLoginFinder` class.
     *
     * @param {KnexUsersRepository} repository - An instance of the repository that manages user records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a user by their Login.
     *
     * @param {string} login - The Login of the user to find.
     * @return {Promise<User>} A promise that resolves to the `User` instance if found, or `null` if not found.
     */
    async execute(login) {
        return this.#repository.findByLogin(new ValueObjectLogin('login', login));
    }
}
