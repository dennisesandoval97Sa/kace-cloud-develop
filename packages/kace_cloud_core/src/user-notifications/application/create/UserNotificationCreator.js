import { DomainUserNotificationFinder, UserNotification } from '../../index.js';
import { CustomError, UniquenessValidator } from '../../../shared/index.js';

export class UserNotificationCreator {
    /** @type {KnexUserNotificationRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainUserNotificationFinder} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of `UserNotificationCreator`.
     *
     * @param {KnexUserNotificationRepository} repository - The repository used to save user notifications.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainUserNotificationFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the process of creating a new user notification.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `UserNotification` object, and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `UserNotification` object.
     * @returns {Promise<void>} A promise that resolves when the `UserNotification` object is successfully created.
     */
    async execute(dto) {
        const userNotification = new UserNotification(dto);

        const result = await this.#finder.execute(userNotification.id.value);
        if (result) {
            throw new CustomError(`User notification with id ${userNotification.id.value} already exists`, 400);
        }

        const uniquenessFields = this.#prepareUniquenessFields(dto);
        await this.#uniquenessValidator.validateMultiple(uniquenessFields);

        await this.#repository.save(userNotification);
        await this.#repository.saveHistory(userNotification);
    }

    #prepareUniquenessFields(dto) {
        return [
            { field: 'asunto', value: dto.asunto },
            { field: 'mensaje', value: dto.mensaje },
            { field: 'user_id', value: dto.user_id },
        ];
    }
}
