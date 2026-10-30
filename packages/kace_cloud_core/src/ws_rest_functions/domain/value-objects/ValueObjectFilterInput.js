import { ValueObjectJson } from '../../../shared/domain/value-object/ValueObjectJson.js';
import { Helper, InvalidArgumentError } from '../../../shared/index.js';

export class ValueObjectFilterInput extends ValueObjectJson {
    static FILTER_INPUT = 0;

    constructor(value, nullable = false) {
        super('filter_input', value, nullable);
        if (!nullable) {
            this.#ensureValidStructure(value);
        }
    }

    /**
     * Ensures that the structure is valid by running all necessary validations.
     *
     * @param {Object} value - The value of the structure to validate
     * @throws {InvalidArgumentError} If the structure fails the validations
     */
    #ensureValidStructure(value) {
        this.#ensureValidFilterInput(value.filter_input);
    }

    /**
     * Validates that filterInput is a valid array and meets the minimum requirements
     *
     * @param {*} filterInput - The value of filterInput to validate
     * @throws {InvalidArgumentError} If filterInput does not meet the requirements
     */
    #ensureValidFilterInput(filterInput) {
        if (!Array.isArray(filterInput) || filterInput.length < ValueObjectFilterInput.FILTER_INPUT) {
            Helper.logError(
                `${this.field}: The "filterInput" property must be an array and must have at least ${ValueObjectFilterInput.FILTER_INPUT} element(s)`
            );
            throw new InvalidArgumentError(
                `${this.field}: The "filterInput" property must be an array and must have at least ${ValueObjectFilterInput.FILTER_INPUT} element(s)`
            );
        }
    }
}
