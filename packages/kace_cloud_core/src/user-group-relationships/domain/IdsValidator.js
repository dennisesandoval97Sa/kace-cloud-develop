import { Criteria, InvalidArgumentError } from '../../shared/index.js';

export class IdsValidator {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #userRepository;
    /** @type {KnexGroupsRepository} is initialized in the constructor */
    #groupRepository;

    /**
     * @param {KnexUsersRepository} userRepository
     * @param {KnexGroupsRepository} groupRepository
     */
    constructor(userRepository, groupRepository) {
        this.#userRepository = userRepository;
        this.#groupRepository = groupRepository;
    }

    async validateRelation(repository, ids) {
        if (!Array.isArray(ids) || !ids.length) return;
        const uniqueUserIds = [...new Set(ids.map((relation) => relation.usuario_id))];
        const uniqueGroupIds = [...new Set(ids.map((relation) => relation.grupo_id))];
        const tablename = repository.tableName;
        const criteria = new Criteria(
            [
                {
                    field: 'usuario_id',
                    operator: 'in',
                    value: uniqueUserIds.join(', '),
                    type: 'and',
                },
                {
                    field: 'grupo_id',
                    operator: 'in',
                    value: uniqueGroupIds.join(', '),
                    type: 'and',
                },
            ],
            null,
            null,
            null,
            null,
            tablename
        );

        const existingRecords = await repository.search(criteria);

        if (existingRecords.length !== ids.length) {
            throw new InvalidArgumentError('One or more relations do not exist');
        }
    }

    /**
     * Validates if all provided IDs exist in the respective repository.
     * @param {string[]} ids - List of IDs to validate.
     * @param {Object} repository - The repository to search in (user or group).
     * @throws {InvalidArgumentError} Throws error if any ID does not exist.
     */
    async #validateIds(ids, repository) {
        const uniqueIds = [...new Set(ids)];
        const tablename = repository.tableName;
        const criteria = new Criteria(
            [
                {
                    field: 'id',
                    operator: 'in',
                    value: uniqueIds.join(', '),
                    type: 'and',
                },
            ],
            null,
            null,
            null,
            null,
            tablename
        );

        const existingRecords = await repository.search(criteria);

        if (existingRecords.length !== uniqueIds.length) {
            throw new InvalidArgumentError('One or more IDs do not exist');
        }
    }

    validateUserIds(userIds) {
        return this.#validateIds(userIds, this.#userRepository);
    }

    validateGroupIds(groupIds) {
        return this.#validateIds(groupIds, this.#groupRepository);
    }

    async destroyDbConnection() {
        await this.#userRepository.destroyConnection();
        await this.#groupRepository.destroyConnection();
    }
}
