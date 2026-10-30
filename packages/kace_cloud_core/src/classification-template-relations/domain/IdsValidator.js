import { Criteria } from '../../shared/criteria/Criteria.js';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';

export class IdsValidator {
    /** @type {KnexClassificationsRepository} is initialized in the constructor */
    #classificationRepository;
    /** @type {KnexTemplatesRepository} is initialized in the constructor */
    #templateRepository;

    /**
     * Creates an instance of `IdsValidator`.
     *
     * @param {KnexClassificationsRepository} classificationRepository - The repository used to validate classification IDs.
     * @param {KnexTemplatesRepository} templateRepository - The repository used to validate template IDs.
     */
    constructor(classificationRepository, templateRepository) {
        this.#classificationRepository = classificationRepository;
        this.#templateRepository = templateRepository;
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
     * Validates if all provided template IDs exist in the template repository.
     * @param {string[]} templateIds - List of template IDs to validate.
     * @throws {InvalidArgumentError} Throws an error if any template ID does not exist.
     */
    async validateTemplateIds(templateIds) {
        await this.#validateIds(templateIds, this.#templateRepository);
    }

    /**
     * Validates if all provided IDs exist in the given repository.
     * @param {string[]} ids - List of IDs to validate.
     * @param {Object} repository - The repository to search in (classification or template).
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
