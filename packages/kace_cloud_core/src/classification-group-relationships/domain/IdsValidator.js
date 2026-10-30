import { Criteria } from '../../shared/criteria/Criteria.js';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';

export class IdsValidator {
    /** @type {KnexClassificationsRepository} is initialized in the constructor */
    #classificationRepository;
    /** @type {KnexGroupsRepository} is initialized in the constructor */
    #groupRepository;
    /** @type {KnexOneScriptRepository} is initialized in the constructor */
    #oneScriptRepository;

    /**
     * Creates an instance of `ClassificationGroupIdsValidator`.
     *
     * @param {KnexClassificationsRepository} classificationRepository - The repository used to validate classification IDs.
     * @param {KnexGroupsRepository} groupRepository - The repository used to validate group IDs.
     * @param {KnexOneScriptRepository} oneScriptRepository - The repository used to validate oneScript IDs.
     */
    constructor(classificationRepository, groupRepository, oneScriptRepository) {
        this.#classificationRepository = classificationRepository;
        this.#groupRepository = groupRepository;
        this.#oneScriptRepository = oneScriptRepository;
    }

    /**
     * Validates if all provided classification IDs exist in the classification repository.
     * @param {string[]} classificationIds - List of classification IDs to validate.
     * @throws {InvalidArgumentError} Throws an error if any classification ID does not exist.
     */
    async validateClassificationIds(classificationIds) {
        await this.#validateIds(classificationIds, this.#classificationRepository);
    }

    /**
     * Validates if all provided group IDs exist in the group repository.
     * @param {string[]} groupIds - List of group IDs to validate.
     * @throws {InvalidArgumentError} Throws an error if any group ID does not exist.
     */
    async validateGroupIds(groupIds) {
        await this.#validateIds(groupIds, this.#groupRepository);
    }

    /**
     * Validates if all provided oneScript IDs exist in the oneScript repository.
     * @param {string[]} oneScriptIds - List of oneScript IDs to validate.
     * @throws {InvalidArgumentError} Throws an error if any oneScript ID does not exist.
     */
    async validateOneScriptIds(oneScriptIds) {
        await this.#validateIds(oneScriptIds, this.#oneScriptRepository);
    }

    /**
     * Validates if all provided IDs exist in the given repository.
     * @param {string[]} ids - List of IDs to validate.
     * @param {Object} repository - The repository to search in (classification or group).
     * @throws {InvalidArgumentError} Throws an error if any ID does not exist.
     */
    async #validateIds(ids, repository) {
        if (!Array.isArray(ids) || !ids.length) return;

        const uniqueIds = [...new Set(ids)];
        const tablename = repository.tableName;
        const criteria = new Criteria(
            [
                {
                    field: 'id',
                    operator: 'in',
                    value: uniqueIds.join(', '),
                    type: 'and',
                },
            ],
            null,
            null,
            null,
            null,
            tablename
        );
        const existingRecords = await repository.search(criteria);

        if (existingRecords.length !== uniqueIds.length) {
            throw new InvalidArgumentError('One or more IDs do not exist');
        }
    }
}
