import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { DomainUserListFinder, UserList } from '../../index';
import { ValidationFailError } from '../../../shared/index.js';

export class UserListCreator {
    /** @type {KnexUserListsRepository} is initialized in the constructor */
    #userListRepository;
    /** @type {userListValidator} is initialized in the constructor */
    #userListValidator;
    /** @type {DomainUserListFinder} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * @param {KnexUserListsRepository} userListsRepository
     * @param {UserListValidator} userListValidator
     */
    constructor(userListRepository, userListValidator) {
        this.#userListRepository = userListRepository;
        this.#userListValidator = userListValidator;
        this.#finder = new DomainUserListFinder(userListRepository);
        this.#uniquenessValidator = new UniquenessValidator(userListRepository);
    }

    /**
     * Executes the use case to create a new user list after validating the user IDs.
     *
     * @param {Object} dto - The data transfer object containing the properties for the new UserList.}
     * @returns {Promise<void>}
     * @throws {InvalidArgumentError}
     */
    async execute(dto) {
        const userList = UserList.create(dto);

        const result = await this.#finder.execute(userList.id.value);
        if (result) {
            throw new ValidationFailError(`User List with id ${userList.id.value} already exists`, 'id');
        }
        await this.#uniquenessValidator.validate('descripcion', dto.descripcion);

        const userIds = dto.lista_usuarios.map((user) => user.id);

        await this.#userListValidator.validateUserIdsExist(userIds);

        if (userList.group_id.value) {
            const isValidGroup = await this.#userListRepository.isValidRelationship('grupos', userList.group_id.value);
            if (!isValidGroup) {
                throw new ValidationFailError(`Group with id ${userList.group_id.value} does not exist`, 'group_id');
            }
        }

        await this.#userListRepository.save(userList);
        await this.#userListRepository.saveHistory(userList);
    }
}
