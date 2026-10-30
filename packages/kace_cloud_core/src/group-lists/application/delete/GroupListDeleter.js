import { CustomError } from '../../../shared/errors/CustomError';
import { DomainGroupListFinder } from '../../index';

export class GroupListDeleter {
    /** @type {KnexGroupListsRepository} is initialized in the constructor*/
    #repository;
    /** @type {DomainAllowedConnectionFinder} is initialized in the constructor*/
    #groupListFinder;

    /**
     * Creates an instance of the `GroupListDeleter` class.
     *
     * @param {KnexUsersRepository} repository - An instance of the repository that manages groupList records.
     */
    constructor(repository) {
        this.#groupListFinder = new DomainGroupListFinder(repository);
        this.#repository = repository;
    }
    /**
     * Deletes an GroupList object from the repository.
     *
     * This method finds the groupList by their ID, applies deletion operations, updates the repository with the modified groupList object, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the groupList object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the groupList object.
     * @returns {Promise<void>} A promise that resolves when the groupList object is deleted.
     */
    async execute(id, dto) {
        const groupList = await this.#groupListFinder.execute(id);

        if (!groupList) {
            throw new CustomError(`Group List with ID ${id} does not exist.`, 404);
        }

        const originalValues = groupList.toJson();
        groupList.delete(dto);

        await this.#repository.update(groupList);
        await this.#repository.saveHistory(groupList, originalValues);

        groupList.flushChanges();
    }
}
