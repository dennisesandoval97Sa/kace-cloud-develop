import { CustomError } from '../../../shared/errors/CustomError';
import { PoliciesFinder as DomainPoliciesFinder } from '../../domain/PoliciesFinder';
import { PolicyResponse } from '../PolicyResponse';

export class PoliciesFinder {
    /**
     *  @type {DomainPoliciesFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     *
     * @param {KnexPoliciesRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainPoliciesFinder(repository);
    }

    /**
     *
     * @param {string} id identificator record to find
     * @returns {Promise<PolicyResponse>}
     */
    async execute(id) {
        const policy = await this.#finder.execute(id);
        if (policy === null) throw new CustomError(`Policy with id ${id} does not exist`, 404);

        return new PolicyResponse(policy);
    }
}
