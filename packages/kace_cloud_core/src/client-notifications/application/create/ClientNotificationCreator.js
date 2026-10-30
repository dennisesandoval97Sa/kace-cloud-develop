import { CustomError } from '../../../shared/errors/CustomError.js';
import { ClientNotification, DomainClientNotificationFinder } from '../../index.js';

export class ClientNotificationCreator {
    /** @type {KnexClientNotificationRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainClientNotificationFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of `ClientNotificationCreator`.
     *
     * @param {KnexClientNotificationRepository} repository - The repository used to save client notifications.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainClientNotificationFinder(repository);
    }

    /**
     * Executes the process of creating a new client notification.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `ClientNotification` object, and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `ClientNotification` object.
     * @returns {Promise<void>} A promise that resolves when the `ClientNotification` object is successfully created.
     */
    async execute(dto) {
        const clientNotification = new ClientNotification(dto);

        const result = await this.#finder.execute(clientNotification.id.value);
        if (result) {
            throw new CustomError(`ClientNotification with ID ${clientNotification.id.value} already exists`, 400);
        }

        await this.#repository.save(clientNotification);
        await this.#repository.saveHistory(clientNotification);
    }
}
