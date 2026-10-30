import { Criteria } from '../../shared/criteria/Criteria.js';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';

export class GroupListValidator {
    /** @type {KnexGroupsRepository} is initialized in the constructor*/
    #groupRepository;

    /**
     * @param {KnexGroupsRepository} groupRepository
     */
    constructor(groupRepository) {
        this.#groupRepository = groupRepository;
    }

    /**
     * Valida que todos los IDs en la lista de grupos existan en la base de datos.
     *
     * @param {Array<string>} groupIds
     * @throws {InvalidGroupException}
     */
    async validateGroupIdsExist(groupIds) {
        const tablename = this.#groupRepository.tableName;
        const criteria = new Criteria(
            [
                {
                    field: 'id',
                    operator: 'in',
                    value: groupIds.join(', '),
                    type: 'and',
                },
            ],
            null,
            null,
            null,
            null,
            tablename
        );
        const existingGroups = await this.#groupRepository.search(criteria);

        if (existingGroups.length !== groupIds.length) {
            throw new InvalidArgumentError('One or more group IDs do not exist');
        }
    }
}
