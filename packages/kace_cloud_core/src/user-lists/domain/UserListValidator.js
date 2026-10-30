import { Criteria } from '../../shared/criteria/Criteria.js';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';

export class UserListValidator {
    /** @type {KnexUserListsRepository} is initialized in the constructor */
    #repository;
    /**
     * @param {KnexUsersRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Valida que todos los IDs en la lista de usuarios existan en la base de datos.
     *
     * @param {Array<string>} userIds
     * @throws {InvalidArgumentError}
     */
    async validateUserIdsExist(userIds) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            [
                {
                    field: 'id',
                    operator: 'in',
                    value: userIds.join(', '),
                    type: 'and',
                },
            ],
            null,
            userIds.length,
            null,
            null,
            tablename
        );
        const existingUsers = await this.#repository.search(criteria);
        if (existingUsers.length !== userIds.length) {
            throw new InvalidArgumentError('One or more user IDs do not exist');
        }
    }
}
