import { Criteria } from '../criteria/Criteria';
import { ValidationFailError } from '../errors/ValidationFailError.js';
import { RESOURCE_ALREADY_EXISTS } from '@kace/error-codes';

export class UniquenessValidator {
    /** is initialized in the constructor*/
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Validates multiple fields for uniqueness, excluding an optional ID.
     * @param {Array} validations - Array of field-value pairs to validate.
     * @param {string|null} excludeId - ID to exclude from the validation.
     * @throws {CustomError} - Throws an error if any duplicates are found.
     */
    async validateMultiple(validations, excludeId = null) {
        const filters = this.#createFilters(validations, excludeId);
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filters, null, null, null, null, tablename);
        const existingEntities = await this.#repository.search(criteria);
        if (existingEntities.length > 0) {
            this.#throwDuplicateError(validations, existingEntities);
        }
    }

    /**
     * Validates a single field for uniqueness.
     * @param {string} fieldName - The name of the field to validate.
     * @param {any} value - The value of the field to validate.
     * @param {string|null} excludeId - ID to exclude from the validation.
     * @throws {CustomError} - Throws an error if a duplicate is found.
     */
    async validate(fieldName, value, excludeId = null) {
        await this.validateMultiple([{ field: fieldName, value }], excludeId);
    }

    /**
     * Creates filter criteria for the uniqueness validation.
     * @param {Array} validations - Array of field-value pairs.
     * @param {string|null} excludeId - ID to exclude from the validation.
     * @returns {Array} - Filters for the criteria.
     */
    #createFilters(validations, excludeId) {
        const filters = validations.map(({ field, value }) => ({
            field,
            operator: 'eq',
            value,
            type: 'AND',
        }));

        if (excludeId) {
            filters.push({
                field: 'id',
                operator: 'neq',
                value: excludeId,
                type: 'AND',
            });
        }
        filters.push({
            field: 'deleted_by',
            operator: 'null',
            value: 'null',
            type: 'AND',
        });

        return filters;
    }

    /**
     * Throws a CustomError if duplicates are found in the existing entities.
     * @param {Array} validations - Array of field-value pairs to validate.
     * @throws {CustomError} - Throws an error with detailed conflict messages.
     */
    #throwDuplicateError(validations) {
        const duplicateFields = validations.map((validation) => ({
            field: validation.field,
            value: validation.value,
        }));

        const errorMessage = `The following value(s) already exist: ${duplicateFields.map(({ field, value }) => field + " '" + value + "'").join(', ')}.`;

        throw new ValidationFailError(errorMessage, 'uniqueness', duplicateFields, RESOURCE_ALREADY_EXISTS);
    }
}
