import { RoleFinderDomain } from '../..';
import { CustomError } from '../../../shared/errors/CustomError';

export class RoleDeleter {
    /** @type {KnexRoleRepository} is initialized in the constructor */
    #repository;

    /** @type {RoleFinderDomain} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexRoleRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new RoleFinderDomain(repository);
    }

    /**
     *
     * @param {string} id id for delete
     * @param {object} dtoDelete dto data for delete, exm {deleted_at: new Date(), deleted_by: 'id_user'}
     * @returns {Promise<void>}
     */
    async execute(id, dtoDelete) {
        const role = await this.#finder.execute(id);

        if (role === null) {
            throw new CustomError(`The role you are trying delete does not exist`, 404);
        }

        role.delete(dtoDelete);
        await this.#repository.delete(role);
        role.flushChanges();
    }
}
