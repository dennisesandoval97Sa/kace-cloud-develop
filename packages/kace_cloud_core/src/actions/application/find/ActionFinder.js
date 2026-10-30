import { CustomError } from '../../../shared/index.js';
import { ActionResponse, DomainActionFinder } from '../../index.js';

export class ActionFinder {
    /**
     * @type {DomainActionFinder}
     * is initialized in the constructor
     */
    #finder;
    /** @type {import('../../../users').User} is initialized in the constructor */
    #currentUser;

    /**
     * Creates an instance of the `ActionFinder` class.
     *
     * @param {KnexActionRepository} repository - An instance of the repository that manages Action records.
     * @param {import('../../../users').User} currentUser - The currently authenticated user object.
     */
    constructor(repository, currentUser) {
        this.#finder = new DomainActionFinder(repository);
        this.#currentUser = currentUser;
    }

    /**
     * Executes the finding of an Action object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Action object to find.
     * @returns {Promise<ActionResponse>} A promise that resolves to an ActionResponse object containing the found Action data.
     */
    async execute(id) {
        const action = await this.#finder.execute(id);
        if (!action || action.isDeleted()) {
            throw new CustomError('Action not found', 404);
        }

        return new ActionResponse(action);
    }
}
