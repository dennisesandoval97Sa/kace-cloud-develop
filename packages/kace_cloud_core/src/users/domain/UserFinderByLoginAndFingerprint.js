import { ValueObjectLogin } from './ValueObjectLogin.js';
import { ValueObjectFingerprint } from './ValueObjectFingerprint.js';

export class UserFinderByLoginAndFingerprint {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `UserFinderByLoginAndFingerprint` class.
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
     * @param {string} fingerprint - The fingerprint of the user to find.
     * @return {Promise<User>} A promise that resolves to the `User` instance if found, or `null` if not found.
     */
    async execute(login, fingerprint) {
        return this.#repository.findByLoginAndFingerprint(
            new ValueObjectLogin('login', login),
            new ValueObjectFingerprint('fingerprint', fingerprint)
        );
    }
}
