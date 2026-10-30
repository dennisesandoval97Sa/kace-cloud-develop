import { DomainAllowedConnectionFinder } from '../../../allowed-conections';
import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { GroupList } from '../../index';

export class GroupListCreator {
    /** @type {KnexGroupListsRepository} is initialized in the constructor*/
    #groupListRepository;
    /** @type {GroupListValidator} is initialized in the constructor*/
    #groupListValidator;
    /** @type {DomainAllowedConnectionFinder} is initialized in the constructor*/
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor*/
    #uniquenessValidator;

    /**
     * @param {KnexGroupListsRepository} groupListsRepository
     * @param {GroupListValidator} groupListValidator
     */
    constructor(groupListRepository, groupListValidator) {
        this.#groupListRepository = groupListRepository;
        this.#groupListValidator = groupListValidator;
        this.#finder = new DomainAllowedConnectionFinder(groupListRepository);
        this.#uniquenessValidator = new UniquenessValidator(groupListRepository);
    }

    /**
     * Executes the use case to create a new group list after validating the group IDs.
     *
     * @param {Object} dto - The data transfer object containing the properties for the new GroupList.}
     * @returns {Promise<void>}
     * @throws {InvalidGroupException}
     */
    async execute(dto) {
        const groupList = GroupList.create(dto);

        const result = await this.#finder.execute(groupList.id.value);
        if (result) {
            throw new CustomError(`Group List with id ${groupList.id.value} already exists`, 400);
        }
        await this.#uniquenessValidator.validate('descripcion', dto.descripcion);

        const groupIds = dto.lista_grupos.map((group) => group.id);
        await this.#groupListValidator.validateGroupIdsExist(groupIds);

        await this.#groupListRepository.save(groupList);
        await this.#groupListRepository.saveHistory(groupList);
    }
}
