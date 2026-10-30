import { CustomError } from '../../../shared';
import { GroupFinderDomain, GroupResponse } from '../../index';

export class GroupFinder {
    /** @type {GroupFinderDomain} is initialized in the constructor*/
    #finder;

    /**
     *
     * @param {KnexGroupsRepository} repository
     */
    constructor(repository) {
        this.#finder = new GroupFinderDomain(repository);
    }

    /**
     *
     * @param {string} id id for search
     * @returns {Promise<GroupResponse>}
     */
    async execute(id) {
        const groups = await this.#finder.execute(id);
        if (!groups || groups.isDeleted()) {
            throw new CustomError('Group not found', 404);
        }
        return new GroupResponse(groups);
    }
}
