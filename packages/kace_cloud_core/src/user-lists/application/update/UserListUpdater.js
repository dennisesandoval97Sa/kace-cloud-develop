import { CustomError, UniquenessValidator, ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { DomainUserListFinder } from '../../index.js';

export class UserListUpdater {
    /** @type {DomainUserListFinder} is initialized in the constructor */
    #userListFinder;
    /** @type {KnexUserListsRepository} is initialized in the constructor */
    #repository;
    /** @type {UserListValidator} is initialized in the constructor */
    #userListValidator;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of the `UserListUpdater` class.
     *
     * @param {KnexUserListsRepository} repository - An instance of the repository that manages userList records.
     * @param {UserListValidator} userListValidator
     */
    constructor(repository, userListValidator) {
        this.#repository = repository;
        this.#userListValidator = userListValidator;
        this.#userListFinder = new DomainUserListFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates a UserList object in the repository.
     *
     * @param {string} id - The unique identifier of the UserList object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the UserList object.
     * @returns {Promise<void>} A promise that resolves when the UserList object is updated.
     */
    async execute(id, dto) {
        if (dto.group_id) {
            new ValueObjectUuid('group_id', dto.group_id, true);
            const isValidGroup = await this.#repository.isValidRelationship('grupos', dto.group_id);
            if (!isValidGroup) {
                throw new ValidationFailError(`Group with id ${dto.group_id} does not exist`, 'group_id');
            }
        }
        const userList = await this.#userListFinder.execute(id);

        if (!userList) {
            throw new CustomError(`User List with ID ${id} does not exist.`, 404);
        }

        if (dto.descripcion) {
            await this.#uniquenessValidator.validate('descripcion', dto.descripcion, id);
        }

        if (dto.lista_usuarios) {
            const userIds = dto.lista_usuarios.map((user) => user.id);
            await this.#userListValidator.validateUserIdsExist(userIds);
        }
        const originalValues = userList.toJson();
        userList.update(dto);

        await this.#repository.update(userList);
        await this.#repository.saveHistory(userList, originalValues);

        userList.flushChanges();
    }
}
