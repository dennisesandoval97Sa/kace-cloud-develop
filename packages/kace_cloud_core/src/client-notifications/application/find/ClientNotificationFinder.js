import { CustomError } from '../../../shared/index.js';
import { ClientNotificationResponse, DomainClientNotificationFinder } from '../../index.js';

export class ClientNotificationFinder {
    /** @type {DomainClientNotificationFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of `ClientNotificationFinder`.
     *
     * @param {KnexClientNotificationRepository} repository - The repository used to access the `ClientNotification` data.
     */
    constructor(repository) {
        this.#finder = new DomainClientNotificationFinder(repository);
    }

    /**
     * Executes the finding of a `ClientNotification` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `ClientNotification` object to find.
     * @returns {Promise<ClientNotificationResponse>} A promise that resolves to a `ClientNotificationResponse` object containing the found `ClientNotification` data.
     */
    async execute(id) {
        const clientNotification = await this.#finder.execute(id);
        if (!clientNotification || clientNotification.isDeleted()) {
            throw new CustomError('Client Notification not found', 404);
        }
        return new ClientNotificationResponse(clientNotification);
    }
}
