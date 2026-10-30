import { CustomError } from '../../../shared/errors/CustomError';
import { PoliciesFinder as DomainPoliciesFinder } from '../../domain/PoliciesFinder';

export class PoliciesDeleter {
    /**
     *  @type {KnexPoliciesRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     *  @type {DomainPoliciesFinder}
     * is initialized in the constructor
     */
    #finder;
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainPoliciesFinder(repository);
    }

    /**
     *
     * @param {object} dto data object with info for delete
     * @param {string} id identificator record to delete
     * @returns {Promise<void>}
     */
    async execute(dto, id) {
        const policy = await this.#finder.execute(id);
        if (policy === null) throw new CustomError(`Policy with id ${id} does not exist`, 404);

        policy.delete(dto);
        await this.#repository.delete(policy);
        policy.flushChanges();
    }
}
