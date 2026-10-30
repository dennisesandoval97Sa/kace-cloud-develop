import { CustomError } from '../../../shared/index.js';
import { DomainGroupListFinder, GroupListResponse } from '../../index.js';

export class GroupListFinder {
    /** @type {DomainAllowedConnectionFinder} is initialized in the constructor*/
    #groupListFinder;

    /**
     * Creates an instance of the `GroupListFinder` class.
     *
     * @param {KnexGroupListsRepository} repository - An instance of the repository that manages groupList records.
     */
    constructor(repository) {
        this.#groupListFinder = new DomainGroupListFinder(repository);
    }

    /**
     * Finds a groupList by their ID.
     *
     * @param {string} id - The UUID of the groupList to find.
     * @return {Promise<GroupList>} A promise that resolves to the `GroupList` instance if found, or `null` if not found.
     */
    async execute(id) {
        const groupList = await this.#groupListFinder.execute(id);
        if (!groupList || groupList.isDeleted()) {
            throw new CustomError('Group List not found', 404);
        }
        return new GroupListResponse(groupList);
    }
}
