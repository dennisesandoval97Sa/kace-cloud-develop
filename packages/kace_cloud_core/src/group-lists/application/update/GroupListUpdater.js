import { CustomError } from '../../../shared/errors/CustomError.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { DomainGroupListFinder } from '../../index.js';

export class GroupListUpdater {
    /** @type {DomainGroupListFinder} is initialized in the constructor */
    #groupListFinder;
    /** @type {GroupListValidator} is initialized in the constructor */
    #groupListValidator;
    /** @type {DomainAllowedConnectionFinder} is initialized in the constructor */
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of the `GroupListUpdater` class.
     *
     * @param {KnexGroupListsRepository} repository - An instance of the repository that manages groupList records.
     */
    constructor(repository, groupListValidator) {
        this.#repository = repository;
        this.#groupListValidator = groupListValidator;
        this.#groupListFinder = new DomainGroupListFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates a GroupList object in the repository.
     *
     * @param {string} id - The unique identifier of the GroupList object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the GroupList object.
     * @returns {Promise<void>} A promise that resolves when the GroupList object is updated.
     */
    async execute(id, dto) {
        const groupList = await this.#groupListFinder.execute(id);

        if (!groupList) {
            throw new CustomError(`Group List with ID ${id} does not exist.`, 404);
        }

        if (dto.descripcion) {
            await this.#uniquenessValidator.validate('descripcion', dto.descripcion, id);
        }
        if (dto.lista_grupos) {
            const groupIds = dto.lista_grupos.map((group) => group.id);
            await this.#groupListValidator.validateGroupIdsExist(groupIds);
        }
        const originalValues = groupList.toJson();
        groupList.update(dto);

        await this.#repository.update(groupList);
        await this.#repository.saveHistory(groupList, originalValues);

        groupList.flushChanges();
    }
}
