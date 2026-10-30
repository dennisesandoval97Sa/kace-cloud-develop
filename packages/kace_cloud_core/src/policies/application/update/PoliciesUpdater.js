import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { PoliciesFinder as DomainPoliciesFinder } from '../../domain/PoliciesFinder';

export class PoliciesUpdater {
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
     * @param {object} dto data object for update
     * @param {string} id identificator for record to update
     * @returns {Promise<void>}
     */
    async execute(dto, id) {
        const policy = await this.#finder.execute(id);
        if (policy === null) {
            throw new CustomError('The role you are trying update does not exist', 404);
        }

        if (dto.title !== undefined) {
            await this.#uniquenessValidator.validate('title', dto.title);
        }
        const originalValues = policy.toJson();
        policy.update(dto);

        await this.#repository.update(policy);
        await this.#repository.saveHistory(policy, originalValues);
        policy.flushChanges();
    }
}
