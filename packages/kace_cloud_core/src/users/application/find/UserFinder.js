import { DomainUserFinder, User, UserResponse } from '../../index';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class UserFinder {
    /** @type {DomainUserFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `UserFinder` class.
     *
     * @param {KnexUsersRepository} repository - An instance of the repository that manages user records.
     * @param {User} user - The currently authenticated user object.
     */
    constructor(repository, currentUser) {
        this.#finder = new DomainUserFinder(repository);
        this.currentUser = currentUser;
    }

    /**
     * Executes the finding of an User object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the User object to find.
     * @param {boolean} logEvent
     * @returns {Promise<UserResponse>} A promise that resolves to an UserResponse object containing the found User data.
     */
    async execute(id, logEvent = false) {
        /** @type {User} */
        const user = await this.#finder.execute(id);
        if (!user || user.isDeleted()) {
            throw new CustomError('User not found', 404);
        }

        return new UserResponse(user);
    }
}
