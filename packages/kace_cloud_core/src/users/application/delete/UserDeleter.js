import { DomainUserFinder } from '../../index';
import { ActionTriggers } from '../../../actions/index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class UserDeleter {
    /** @type {DomainUserFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;
    /** @type {ActionExecutionDomainService} is initialized in the constructor */
    #actionExecutionService;

    /**
     * Creates an instance of the `UserDeleter` class.
     *
     * @param {KnexUsersRepository} repository - An instance of the repository that manages user records.
     * @param {ActionExecutionDomainService}actionExecutionService
     */
    constructor(repository, actionExecutionService) {
        this.#repository = repository;
        this.#finder = new DomainUserFinder(repository);
        this.#actionExecutionService = actionExecutionService;
    }

    /**
     * Deletes an User object from the repository.
     *
     * This method finds the user by their ID, applies deletion operations, updates the repository with the modified user object, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the User object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the User object.
     * @returns {Promise<void>} A promise that resolves when the User object is deleted.
     */
    async execute(id, dto) {
        const user = await this.#finder.execute(id);

        // Same contract as UserFinder: a deleted user does not exist, and deleting it again would
        // overwrite who deleted it and when.
        if (!user || user.isDeleted()) {
            throw new CustomError('User not found', 404);
        }

        const originalValues = user.toJson();
        user.delete(dto);

        await this.#repository.update(user);
        await this.#repository.saveHistory(user, originalValues);

        user.flushChanges();

        if (this.#actionExecutionService) {
            await this.#actionExecutionService.execute(ActionTriggers.DELETE_USER.value, user);
        }
    }
}
