import { CustomError } from '../../../shared/index.js';
import { AllowedConnectionResponse, DomainAllowedConnectionFinder } from '../../index.js';

export class AllowedConnectionFinder {
    /**
     * @type {DomainAllowedConnectionFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * Creates an instance of `AllowedConnectionFinder`.
     *
     * @param {KnexClientNotificationRepository} repository - The repository used to access the `AllowedConnection` data.
     */
    constructor(repository) {
        this.#finder = new DomainAllowedConnectionFinder(repository);
    }

    /**
     * Executes the finding of a `AllowedConnection` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `AllowedConnection` object to find.
     * @returns {Promise<AllowedConnectionResponse>} A promise that resolves to a `AllowedConnectionResponse` object containing the found `AllowedConnection` data.
     */
    async execute(id) {
        const allowedConnection = await this.#finder.execute(id);
        if (!allowedConnection || allowedConnection.isDeleted()) {
            throw new CustomError('Allowed connection not found', 404);
        }

        return new AllowedConnectionResponse(allowedConnection);
    }
}
