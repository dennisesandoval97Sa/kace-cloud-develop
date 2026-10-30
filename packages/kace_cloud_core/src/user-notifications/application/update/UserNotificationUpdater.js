import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { DomainUserNotificationFinder } from '../../index.js';

export class UserNotificationUpdater {
    /** @type {DomainUserNotificationFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexUserNotificationRepository} is initialized in the constructor */
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of the `UserNotificationUpdater` class.
     *
     * @param {KnexNotificationRepository} repository - An instance of the repository that manages user notification records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainUserNotificationFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates a `UserNotification` object in the repository.
     *
     * @param {string} id - The unique identifier of the `UserNotification` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `UserNotification` object.
     * @returns {Promise<void>} A promise that resolves when the `UserNotification` object is updated.
     */
    async execute(id, dto) {
        const userNotification = await this.#finder.execute(id);

        if (!userNotification) {
            throw new Error(`User notification with ID ${id} does not exist.`);
        }

        if (dto.asunto || dto.mensaje || dto.user_id) {
            const uniquenessFields = this.#prepareUniquenessFields(dto, userNotification);
            await this.#uniquenessValidator.validateMultiple(uniquenessFields);
        }

        const originalValues = userNotification.toJson();
        userNotification.update(dto);

        await this.#repository.update(userNotification);
        await this.#repository.saveHistory(userNotification, originalValues);

        userNotification.flushChanges();
    }

    #prepareUniquenessFields(dto, userNotification) {
        const fields = ['asunto', 'mensaje', 'user_id'];

        return fields.map((field) => ({
            field,
            value: dto[field] !== undefined ? dto[field] : userNotification[field].value,
        }));
    }
}
