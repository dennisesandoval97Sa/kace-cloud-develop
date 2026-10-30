import { Policy } from '../../domain/Policy';
import { PoliciesFinder as DomainPoliciesFinder } from '../../domain/PoliciesFinder';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { CustomError } from '../../../shared/errors/CustomError';

export class PoliciesCreator {
    /** @type {KnexPoliciesRepository} is initialized in the constructor */
    #repository;
    /**
     *  @type {DomainPoliciesFinder}
     * is initialized in the constructor
     */
    #finder;

    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     *
     * @param {KnexPoliciesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainPoliciesFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     *
     * @param {object} payload data object for create new policy
     * @returns {Promise<void>}
     */
    async execute(payload) {
        const policy = Policy.create(payload);
        const existSameId = await this.#finder.execute(policy.id.value);

        if (existSameId) throw new CustomError(`Policy with id ${policy.id.value} already exist`, 400);

        await this.#uniquenessValidator.validate('title', policy.title.value);

        await this.#repository.save(policy);
        await this.#repository.saveHistory(policy);
    }
}
