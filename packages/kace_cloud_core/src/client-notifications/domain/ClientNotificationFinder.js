import { ValueObjectUuid } from '../../shared/index.js';

export class ClientNotificationFinder {
    /** @type {KnexClientNotificationRepository} is initialized in the constructor */
    #repository;

    /**
     * Constructs a new instance of ClientNotificationFinder.
     * @param {KnexClientNotificationRepository} repository - The repository used to find client notifications.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the operation to find a client notification by its ID.
     * @param {string} id - The unique identifier of the client notification.
     * @returns {Promise<ClientNotification | null>} A promise that resolves to the found client notification, or null if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
