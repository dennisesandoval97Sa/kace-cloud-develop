import { CustomError } from '../../../shared';
import { RoleFinderDomain } from '../../index';
import { RoleResponse } from '../RoleResponse';

export class RoleFinder {
    /** @type {RoleFinderDomain} is initialized in the constructor*/
    #finder;

    /**
     *
     * @param {KnexRoleRepository} repository
     */
    constructor(repository) {
        this.#finder = new RoleFinderDomain(repository);
    }

    /**
     *
     * @param {string} id id for search
     * @return {Promise<RoleResponse>}
     */
    async execute(id) {
        const roleFinder = await this.#finder.execute(id);
        if (!roleFinder || roleFinder.isDeleted()) {
            throw new CustomError('role not found', 404);
        }
        return new RoleResponse(roleFinder);
    }
}
