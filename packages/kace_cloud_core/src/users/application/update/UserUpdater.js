import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { DomainUserFinder } from '../../index.js';
import { ActionTriggers } from '../../../actions/index.js';

export class UserUpdater {
    /** @type {DomainUserFinder} is initialized in the constructor */
    #userFinder;
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /** @type {ActionExecutionDomainService} is initialized in the constructor */
    #actionExecutionService;

    constructor(repository, actionExecutionService) {
        this.#repository = repository;
        this.#userFinder = new DomainUserFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#actionExecutionService = actionExecutionService;
    }

    /**
     * Updates a User object in the repository.
     *
     * @param {string} id - The unique identifier of the User object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the User object.
     * @returns {Promise<void>} A promise that resolves when the User object is updated.
     */
    async execute(id, dto) {
        const user = await this.#userFinder.execute(id);

        if (!user) {
            throw new Error(`User with ID ${id} does not exist.`);
        }

        if (dto.login) {
            await this.#uniquenessValidator.validate('login', dto.login, id);
        }

        const originalValues = user.toJson();
        user.update(dto);

        await this.#repository.update(user);
        await this.#repository.saveHistory(user, originalValues);

        user.flushChanges();

        if (this.#actionExecutionService) {
            await this.#actionExecutionService.execute(ActionTriggers.UPDATE_USER.value, user);
        }
    }
}
